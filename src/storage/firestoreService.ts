import { GWACHEON_HISTORICAL_EVENTS, mergeGwacheonHistory } from '../data/gwacheonHistoricalEvents.ts';
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  FIRESTORE_COLLECTIONS,
  FirestoreCollectionCycleDoc,
  FirestoreDocumentDoc,
  FirestoreEventDoc,
  FirestoreProjectDoc,
  FirestoreTelegramDeliveryDoc,
  FirestoreAreaDevelopmentDoc,
  FirestorePlanVersionDoc,
  FirestoreUnitTypeDoc,
  FirestorePlanAssetDoc,
  FirestoreSitePlanDoc,
  FirestoreBuildingDoc,
} from '../schema/firestoreSchema';
import { REDEVELOPMENT_SEED_PROJECTS } from '../registry/redevelopmentRegistry';
import { resolveProjectStatutoryStage } from '../utils/redevelopmentStages';
import { CHOKJIN3_HISTORICAL_EVENTS } from '../data/chokjin3HistoricalEvents';
import { UDONG3_HISTORICAL_EVENTS } from '../data/udong3HistoricalEvents';
import { SAMIK_BEACH_HISTORICAL_EVENTS } from '../data/samikBeachHistoricalEvents';
import { AREA_DEVELOPMENTS_DATA } from '../data/areaDevelopmentsData';
import {
  CHOKJIN3_PLAN_VERSION,
  CHOKJIN3_LAYOUT_ASSET,
  CHOKJIN3_UNIT_TYPES,
  CHOKJIN3_SITE_PLAN,
  CHOKJIN3_BUILDINGS,
} from '../data/chokjin3PlanData';

export interface StorageWriteOptions {
  production?: boolean;
}

export interface FirestoreErrorDiagnostic {
  operation: string;
  collection: string;
  documentId: string;
  firestoreErrorCode?: string | number;
  firestoreErrorName?: string;
  safeMessage: string;
}

export class FirestoreUnavailableError extends Error {
  public readonly operation?: string;
  public readonly collection?: string;
  public readonly documentId?: string;
  public readonly firestoreErrorCode?: string | number;
  public readonly firestoreErrorName?: string;
  public readonly safeMessage?: string;
  public readonly originalError?: any;

  constructor(
    message = 'Firestore is unavailable. Memory fallback is strictly forbidden for production operations.',
    diagnostic?: Partial<FirestoreErrorDiagnostic>,
    originalError?: any
  ) {
    super(message);
    this.name = 'FirestoreUnavailableError';
    this.operation = diagnostic?.operation;
    this.collection = diagnostic?.collection;
    this.documentId = diagnostic?.documentId;
    this.firestoreErrorCode = diagnostic?.firestoreErrorCode;
    this.firestoreErrorName = diagnostic?.firestoreErrorName;
    this.safeMessage = diagnostic?.safeMessage || message;
    this.originalError = originalError;
  }
}

/**
 * Recursively sanitizes any payload for safe Firestore serialization.
 * - Removes undefined fields (both top-level and deeply nested)
 * - Replaces NaN, Infinity, -Infinity with null
 * - Strips function definitions
 * - Guards against circular references
 * - Converts Dates to valid ISO-8601 strings
 * - Cleans nested arrays by filtering out undefined
 */
export function sanitizeForFirestore<T>(data: T, seen = new WeakSet()): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'number') {
    if (Number.isNaN(data) || !Number.isFinite(data)) {
      return null as any;
    }
    return data;
  }

  if (typeof data === 'function') {
    return undefined as any;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (data instanceof Date) {
    return (isNaN(data.getTime()) ? new Date().toISOString() : data.toISOString()) as any;
  }

  if (seen.has(data as object)) {
    return undefined as any;
  }
  seen.add(data as object);

  if (Array.isArray(data)) {
    const cleanedArray: any[] = [];
    for (const item of data) {
      const cleaned = sanitizeForFirestore(item, seen);
      if (cleaned !== undefined && typeof cleaned !== 'function') {
        cleanedArray.push(cleaned);
      }
    }
    return cleanedArray as any;
  }

  const cleanedObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value === undefined || typeof value === 'function') {
      continue;
    }
    const cleaned = sanitizeForFirestore(value, seen);
    if (cleaned !== undefined && typeof cleaned !== 'function') {
      cleanedObj[key] = cleaned;
    }
  }

  return cleanedObj as T;
}

/**
 * Dedicated Firestore Service for Busan Redevelopment Monitor
 *
 * Implements 5 Production Collections:
 * - projects (master projects: chokjin-3, udong-3)
 * - documents (news articles & official items deduplicated by URL sha256)
 * - events (deduplicated event clusters)
 * - collectionCycles (poll cycle audits & "why no alert" explanations)
 * - telegramDeliveries (actual dispatch records, preventing re-sends)
 *
 * Resilience & Safety Policies:
 * - Production fail-closed: /api/jobs/poll & production persistence strictly forbid memory fallback.
 * - Telegram send ordering: Event 저장 -> delivery pending 기록 (atomic) -> API 호출 -> 결과 sent/failed 기록.
 * - Memory fallback allowed strictly for development/dashboard viewing.
 */
/**
 * Retention for Firestore TTL policies on the `expiresAt` field (enable once per collection:
 * see README "데이터 보관 기간"). Events and Telegram delivery records are kept indefinitely
 * because they are the project history and the duplicate-alert guard.
 */
export const RETENTION_DAYS = { collectionCycles: 30, documents: 365, analysisCache: 30 } as const;
export function ttlTimestamp(days: number): Timestamp {
  return Timestamp.fromMillis(Date.now() + days * 86_400_000);
}

/**
 * Caps for the in-process mirror. Live data is in Firestore; the mirror only serves dev views
 * and fallback reads, so unbounded growth on a long-lived Cloud Run instance is a leak.
 */
const MEMORY_LIMITS = { documents: 500, events: 1000, cycles: 20, deliveries: 200 } as const;
/** Drops the oldest-inserted entries beyond limit. Entries matching keep() (seeded history) are never dropped. */
function trimMap<K, V>(map: Map<K, V>, limit: number, keep: (value: V) => boolean = () => false) {
  if (map.size <= limit) return;
  for (const [key, value] of map) {
    if (keep(value)) continue;
    map.delete(key);
    if (map.size <= limit) break;
  }
}

/** Union of event sources keyed by URL (existing first, capped to keep documents small). */
export function mergeEventSources<T extends { url?: string }>(existing: T[] | undefined, incoming: T[] | undefined): T[] {
  const merged = new Map<string, T>();
  for (const src of [...(existing || []), ...(incoming || [])]) {
    if (!src) continue;
    const key = src.url || JSON.stringify(src);
    if (!merged.has(key)) merged.set(key, src);
  }
  return Array.from(merged.values()).slice(0, 30);
}

export class FirestoreService {
  private firestore: Firestore | null = null;
  private isConnected = false;
  private initAttempted = false;
  private initError: string | null = null;
  private forceFail = false;
  // Lazily-created clients may retry after a failed first connection (cold-start blips
  // must not pin an instance to memory mode until restart). Injected clients never retry.
  private initRetryable = true;
  private lastInitAttemptAt = 0;
  private static readonly INIT_RETRY_INTERVAL_MS = 30_000;

  // In-memory operational store (serves as view cache for development/inspection)
  private memoryProjects = new Map<string, FirestoreProjectDoc>();
  private memoryDocuments = new Map<string, FirestoreDocumentDoc>();
  private memoryEvents = new Map<string, FirestoreEventDoc>();
  private memoryAreaDevelopments = new Map<string, FirestoreAreaDevelopmentDoc>();
  private memoryPlanVersions = new Map<string, FirestorePlanVersionDoc>();
  private memoryUnitTypes = new Map<string, FirestoreUnitTypeDoc>();
  private memoryPlanAssets = new Map<string, FirestorePlanAssetDoc>();
  private memorySitePlans = new Map<string, FirestoreSitePlanDoc>();
  private memoryBuildings = new Map<string, FirestoreBuildingDoc>();
  private memoryCycles: FirestoreCollectionCycleDoc[] = [];
  private memoryDeliveries: FirestoreTelegramDeliveryDoc[] = [];

  constructor(options?: {
    firestore?: Firestore | null;
    forceFail?: boolean;
    simulatedConnected?: boolean;
  }) {
    if (options?.firestore !== undefined) {
      this.firestore = options.firestore;
      this.isConnected = options.firestore !== null;
      this.initAttempted = true;
      this.initRetryable = false;
    }
    if (options?.forceFail) {
      this.forceFail = true;
      this.isConnected = false;
      this.initAttempted = true;
      this.initRetryable = false;
      this.initError = 'Simulated Firestore connection failure for fail-closed test';
    }
    if (options?.simulatedConnected) {
      this.isConnected = true;
      this.initAttempted = true;
      this.initRetryable = false;
      this.initError = null;
      this.firestore = this.createSimulatedFirestoreClient() as any;
    }
    this.seedInitialProjects();
  }

  private createSimulatedFirestoreClient(): any {
    const memStore = new Map<string, Map<string, any>>();
    const getCol = (name: string) => {
      if (!memStore.has(name)) memStore.set(name, new Map());
      return memStore.get(name)!;
    };

    let txQueue = Promise.resolve();

    const createQuery = (colName: string) => ({
      doc: (docId: string) => ({
        get: async () => {
          const data = getCol(colName).get(docId);
          return { exists: !!data, data: () => data };
        },
        set: async (data: any, setOpts?: { merge?: boolean }) => {
          if (setOpts?.merge) {
            const prev = getCol(colName).get(docId) || {};
            getCol(colName).set(docId, { ...prev, ...data });
          } else {
            getCol(colName).set(docId, data);
          }
        },
        update: async (data: any) => {
          const prev = getCol(colName).get(docId) || {};
          getCol(colName).set(docId, { ...prev, ...data });
        },
      }),
      orderBy: (field?: string, direction?: 'asc' | 'desc') => ({
        limit: (n: number) => ({
          get: async () => ({
            empty: getCol(colName).size === 0,
            docs: Array.from(getCol(colName).values())
              .slice(0, n)
              .map((d) => ({ data: () => d })),
          }),
        }),
        get: async () => ({
          empty: getCol(colName).size === 0,
          docs: Array.from(getCol(colName).values()).map((d) => ({ data: () => d })),
        }),
      }),
      limit: (n: number) => ({
        get: async () => ({
          empty: getCol(colName).size === 0,
          docs: Array.from(getCol(colName).values())
            .slice(0, n)
            .map((d) => ({ data: () => d })),
        }),
      }),
      get: async () => ({
        empty: getCol(colName).size === 0,
        docs: Array.from(getCol(colName).values()).map((d) => ({ data: () => d })),
      }),
    });

    return {
      collection: (colName: string) => createQuery(colName),
      runTransaction: async (fn: (transaction: any) => Promise<any>) => {
        // Enforce sequential transactional execution to model document-level locking
        const task = async () => {
          const tx = {
            get: async (docRef: any) => docRef.get(),
            set: async (docRef: any, data: any, setOpts?: any) => docRef.set(data, setOpts),
            update: async (docRef: any, data: any) => docRef.update(data),
          };
          return fn(tx);
        };
        const nextPromise = txQueue.then(task, task);
        txQueue = nextPromise.then(() => {}, () => {});
        return nextPromise;
      },
    };
  }

  private seedInitialProjects() {
    for (const p of REDEVELOPMENT_SEED_PROJECTS) {
      this.memoryProjects.set(p.id, {
        ...p,
        isActiveMonitoring: p.isActiveMonitoring ?? false,
        updatedAt: new Date().toISOString(),
      });
    }
    // Seed verified historical events (chokjin-3 SSOT)
    for (const evt of CHOKJIN3_HISTORICAL_EVENTS) {
      if (!this.memoryEvents.has(evt.id)) {
        this.memoryEvents.set(evt.id, { ...evt });
      }
    }
    // Seed verified historical events (udong-3 SSOT)
    for (const evt of UDONG3_HISTORICAL_EVENTS) {
      if (!this.memoryEvents.has(evt.id)) {
        this.memoryEvents.set(evt.id, { ...evt });
      }
    }
    // Seed verified historical events (samik-beach SSOT)
    for (const evt of SAMIK_BEACH_HISTORICAL_EVENTS) {
      if (!this.memoryEvents.has(evt.id)) {
        this.memoryEvents.set(evt.id, { ...evt });
      }
    }
    for (const evt of GWACHEON_HISTORICAL_EVENTS) this.memoryEvents.set(evt.id, { ...evt });
    // Seed verified area developments (11 plans Phase 4C SSOT)
    for (const dev of AREA_DEVELOPMENTS_DATA) {
      if (!this.memoryAreaDevelopments.has(dev.developmentId)) {
        this.memoryAreaDevelopments.set(dev.developmentId, { ...dev });
      }
    }
    // Seed verified chokjin3 plan version & layout asset (Phase 4D SSOT)
    this.memoryPlanVersions.set(CHOKJIN3_PLAN_VERSION.planVersionId, { ...CHOKJIN3_PLAN_VERSION });
    this.memoryPlanAssets.set(CHOKJIN3_LAYOUT_ASSET.assetId, { ...CHOKJIN3_LAYOUT_ASSET });

    // Seed verified chokjin3 unit types (39 types Phase 4D SSOT)
    for (const ut of CHOKJIN3_UNIT_TYPES) {
      this.memoryUnitTypes.set(ut.unitTypeId, { ...ut });
    }

    // Seed verified chokjin3 site plan (Phase 4D-5D SSOT)
    this.memorySitePlans.set(CHOKJIN3_SITE_PLAN.sitePlanId, { ...CHOKJIN3_SITE_PLAN });

    // Seed verified chokjin3 buildings (18 buildings Phase 4D-5D SSOT)
    for (const bldg of CHOKJIN3_BUILDINGS) {
      this.memoryBuildings.set(bldg.buildingId, { ...bldg });
    }
  }

  /**
   * Lazy initialize Firestore client
   */
  public async getClient(): Promise<Firestore | null> {
    if (this.forceFail) {
      this.isConnected = false;
      return null;
    }

    if (this.initAttempted) {
      const canRetry = this.initRetryable && this.firestore === null &&
        Date.now() - this.lastInitAttemptAt >= FirestoreService.INIT_RETRY_INTERVAL_MS;
      if (!canRetry) return this.firestore;
      console.log('[FirestoreService] Retrying Firestore connection after earlier failure.');
    }
    this.initAttempted = true;
    this.lastInitAttemptAt = Date.now();

    try {
      const databaseId = process.env.FIRESTORE_DATABASE_ID || '(default)';
      const projectId =
        process.env.FIRESTORE_PROJECT_ID ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCP_PROJECT ||
        undefined;

      const firestore = new Firestore({
        projectId,
        databaseId: databaseId === '(default)' ? undefined : databaseId,
        ignoreUndefinedProperties: true,
      });

      // Quick ping test to verify credentials and project access
      await firestore.collection(FIRESTORE_COLLECTIONS.PROJECTS).limit(1).get();
      this.firestore = firestore;
      this.isConnected = true;
      console.log(`[FirestoreService] Connected successfully to Firestore database: ${databaseId}`);
      // Immutable IDs and create preconditions make this safe across restarts/instances.
      // Historical events never enter collection/Telegram dispatch workflows.
      try {
        await Promise.all(GWACHEON_HISTORICAL_EVENTS.map(async event => {
          try { await firestore.collection(FIRESTORE_COLLECTIONS.EVENTS).doc(event.id).create(event); }
          catch (error: any) { if (error?.code !== 6 && error?.code !== 'already-exists') throw error; }
        }));
        console.log('[GwacheonHistory] Official baseline ensured: 21 records');
      } catch (error: any) {
        console.warn('[GwacheonHistory] Persistence failed; verified baseline remains visible:', error?.code || 'unknown');
      }
      return this.firestore;
    } catch (err: any) {
      this.initError = err.message || String(err);
      this.isConnected = false;
      this.firestore = null;
      console.warn(
        `[FirestoreService] Real Firestore connection not active (${this.initError}).`
      );
      return null;
    }
  }

  /**
   * Safe diagnostic error extractor.
   * Strips potential secrets and raw payload data while preserving Firestore error codes, names, and safe messages.
   */
  public extractFirestoreErrorDetails(
    err: any,
    context: { operation: string; collection: string; documentId: string }
  ): FirestoreErrorDiagnostic {
    const code = err?.code ?? err?.status ?? undefined;
    const name = err?.name || (err?.constructor ? err.constructor.name : 'FirestoreError');
    const rawMsg = err?.message || String(err);
    const safeMsg = rawMsg.length > 300 ? rawMsg.slice(0, 300) + '...' : rawMsg;

    const diagnostic: FirestoreErrorDiagnostic = {
      operation: context.operation,
      collection: context.collection,
      documentId: context.documentId,
      firestoreErrorCode: code,
      firestoreErrorName: name,
      safeMessage: safeMsg,
    };

    console.error(`[FirestoreService:DIAGNOSTIC] Write failure:`, {
      operation: diagnostic.operation,
      collection: diagnostic.collection,
      documentId: diagnostic.documentId,
      firestoreErrorCode: diagnostic.firestoreErrorCode,
      firestoreErrorName: diagnostic.firestoreErrorName,
      safeMessage: diagnostic.safeMessage,
    });

    return diagnostic;
  }

  public async checkReady(): Promise<{ ready: boolean; available: boolean; error: string | null }> {
    await this.getClient();
    const ready = Boolean(this.isConnected && this.firestore !== null);
    return {
      ready,
      available: ready,
      error: ready ? null : (this.initError || 'Firestore client is unavailable or connection test failed'),
    };
  }

  public getConnectionStatus() {
    return {
      connected: this.isConnected,
      available: this.isConnected && this.firestore !== null,
      ready: this.isConnected && this.firestore !== null,
      databaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
      mode: this.isConnected ? 'live_firestore' : 'in_memory_fallback',
      error: this.initError,
      memoryCounts: {
        projects: this.memoryProjects.size,
        documents: this.memoryDocuments.size,
        events: this.memoryEvents.size,
        areaDevelopments: this.memoryAreaDevelopments.size,
        planVersions: this.memoryPlanVersions.size,
        unitTypes: this.memoryUnitTypes.size,
        planAssets: this.memoryPlanAssets.size,
        cycles: this.memoryCycles.length,
        deliveries: this.memoryDeliveries.length,
      },
    };
  }

  // ==========================================
  // 1. Projects Collection
  // ==========================================

  public async getProject(projectId: string): Promise<FirestoreProjectDoc | null> {
    const client = await this.getClient();
    if (client) {
      try {
        const doc = await client.collection(FIRESTORE_COLLECTIONS.PROJECTS).doc(projectId).get();
        if (doc.exists) return doc.data() as FirestoreProjectDoc;
      } catch (err) {
        console.error(`[FirestoreService] Error fetching project ${projectId}:`, err);
      }
    }
    return this.memoryProjects.get(projectId) || null;
  }

  public async getAllProjects(): Promise<FirestoreProjectDoc[]> {
    const client = await this.getClient();
    if (client) {
      try {
        const snapshot = await client.collection(FIRESTORE_COLLECTIONS.PROJECTS).get();
        if (!snapshot.empty) {
          const projects = new Map(REDEVELOPMENT_SEED_PROJECTS.map(p => [p.id, p as FirestoreProjectDoc]));
          for (const doc of snapshot.docs) { const p = doc.data() as FirestoreProjectDoc; projects.set(p.id, p); }
          return [...projects.values()];
        }
      } catch (err) {
        console.error('[FirestoreService] Error fetching all projects:', err);
      }
    }
    return Array.from(this.memoryProjects.values());
  }

  public async saveProject(project: FirestoreProjectDoc, options?: StorageWriteOptions): Promise<void> {
    const docId = project?.id;
    if (!docId || typeof docId !== 'string' || docId.trim() === '') {
      throw new Error('Invalid project ID: must be a non-empty string');
    }

    const client = await this.getClient();
    if (options?.production && (!client || !this.isConnected)) {
      throw new FirestoreUnavailableError('Cannot save project in production: Firestore is unavailable.');
    }

    const sanitizedProject = sanitizeForFirestore(project);
    this.memoryProjects.set(docId, sanitizedProject);

    if (client) {
      try {
        await client
          .collection(FIRESTORE_COLLECTIONS.PROJECTS)
          .doc(docId)
          .set(sanitizedProject, { merge: true });
      } catch (err: any) {
        const diagnostic = this.extractFirestoreErrorDetails(err, {
          operation: 'saveProject',
          collection: FIRESTORE_COLLECTIONS.PROJECTS,
          documentId: docId,
        });
        if (options?.production) {
          throw new FirestoreUnavailableError(
            `Error saving production project ${docId}: ${diagnostic.safeMessage}`,
            diagnostic,
            err
          );
        }
        console.error(`[FirestoreService] Error saving project ${docId}:`, diagnostic);
      }
    }
  }

  // ==========================================
  // 2. Documents Collection (Duplicate prevention by URL Hash)
  // ==========================================

  public hashUrl(url: string): string {
    return createHash('sha256').update(url.trim()).digest('hex');
  }

  public async saveDocument(
    doc: FirestoreDocumentDoc,
    options?: StorageWriteOptions
  ): Promise<{ isNew: boolean }> {
    const client = await this.getClient();
    if (options?.production && (!client || !this.isConnected)) {
      throw new FirestoreUnavailableError(
        'Cannot persist production document: Firestore is unavailable (Memory fallback is strictly forbidden for production).'
      );
    }

    const docId = (doc?.id && typeof doc.id === 'string' && doc.id.trim() !== '')
      ? doc.id.trim()
      : this.hashUrl(doc?.url || '');

    if (!docId || typeof docId !== 'string' || docId.trim() === '') {
      throw new Error('Invalid document ID: must be a non-empty string');
    }

    const normalizedDoc = sanitizeForFirestore({ ...doc, id: docId });

    const isExistingInMemory = this.memoryDocuments.has(docId);
    this.memoryDocuments.set(docId, normalizedDoc);
    trimMap(this.memoryDocuments, MEMORY_LIMITS.documents);

    if (client) {
      try {
        const docRef = client.collection(FIRESTORE_COLLECTIONS.DOCUMENTS).doc(docId);
        const existing = await docRef.get();
        // Refreshed on every sighting, so only articles unseen for a year expire.
        const withTtl = { ...normalizedDoc, expiresAt: ttlTimestamp(RETENTION_DAYS.documents) };
        if (existing.exists) {
          await docRef.set(withTtl, { merge: true });
          return { isNew: false };
        } else {
          await docRef.set(withTtl);
          return { isNew: true };
        }
      } catch (err: any) {
        const diagnostic = this.extractFirestoreErrorDetails(err, {
          operation: 'saveDocument',
          collection: FIRESTORE_COLLECTIONS.DOCUMENTS,
          documentId: docId,
        });
        if (options?.production) {
          throw new FirestoreUnavailableError(
            `Error saving production document ${docId}: ${diagnostic.safeMessage}`,
            diagnostic,
            err
          );
        }
        console.error(`[FirestoreService] Error saving document ${docId}:`, diagnostic);
      }
    }

    return { isNew: !isExistingInMemory };
  }

  public async getRecentDocuments(limit = 30): Promise<FirestoreDocumentDoc[]> {
    const client = await this.getClient();
    if (client) {
      try {
        const snapshot = await client
          .collection(FIRESTORE_COLLECTIONS.DOCUMENTS)
          .orderBy('publishedAt', 'desc')
          .limit(limit)
          .get();
        if (!snapshot.empty) {
          return snapshot.docs.map((d) => d.data() as FirestoreDocumentDoc);
        }
        return [];
      } catch (err) {
        console.error('[FirestoreService] Error getting documents:', err);
        throw new FirestoreUnavailableError('News documents could not be read from Firestore.');
      }
    }
    return Array.from(this.memoryDocuments.values())
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, limit);
  }

  // ==========================================
  // 3. Events Collection (Deduplication by Cluster ID)
  // ==========================================

  public async saveEvent(
    event: FirestoreEventDoc,
    options?: StorageWriteOptions
  ): Promise<{ isNew: boolean }> {
    const client = await this.getClient();
    if (options?.production && (!client || !this.isConnected)) {
      throw new FirestoreUnavailableError(
        'Cannot persist production event: Firestore is unavailable. Memory fallback is strictly forbidden in production.'
      );
    }

    const docId = event?.id;
    if (!docId || typeof docId !== 'string' || docId.trim() === '') {
      throw new Error('Invalid event ID: must be a non-empty string');
    }

    const isExisting = this.memoryEvents.has(docId);
    const existingMemory = this.memoryEvents.get(docId);

    const alreadyDispatched = existingMemory?.alreadyDispatched || event.alreadyDispatched || false;
    const telegramDispatchedAt = existingMemory?.telegramDispatchedAt || event.telegramDispatchedAt;

    const mergedEvent: FirestoreEventDoc = sanitizeForFirestore({
      ...event,
      id: docId,
      firstSeenAt: existingMemory?.firstSeenAt || event.firstSeenAt,
      sources: mergeEventSources(existingMemory?.sources, event.sources),
      alreadyDispatched,
      telegramDispatchedAt,
      lastSeenAt: new Date().toISOString(),
    });

    this.memoryEvents.set(docId, mergedEvent);
    trimMap(this.memoryEvents, MEMORY_LIMITS.events, (e) => Boolean(e.isHistorical));

    if (client) {
      try {
        const docRef = client.collection(FIRESTORE_COLLECTIONS.EVENTS).doc(docId);
        const existing = await docRef.get();
        if (existing.exists) {
          const remoteData = existing.data() as FirestoreEventDoc;
          mergedEvent.alreadyDispatched = remoteData.alreadyDispatched || alreadyDispatched;
          mergedEvent.telegramDispatchedAt = remoteData.telegramDispatchedAt || telegramDispatchedAt;
          // Keep the original discovery time and accumulate sources instead of overwriting them.
          if (remoteData.firstSeenAt) mergedEvent.firstSeenAt = remoteData.firstSeenAt;
          mergedEvent.sources = mergeEventSources(remoteData.sources, mergedEvent.sources);
          await docRef.set(mergedEvent, { merge: true });
          return { isNew: false };
        } else {
          await docRef.set(mergedEvent);
          return { isNew: true };
        }
      } catch (err: any) {
        const diagnostic = this.extractFirestoreErrorDetails(err, {
          operation: 'saveEvent',
          collection: FIRESTORE_COLLECTIONS.EVENTS,
          documentId: docId,
        });
        if (options?.production) {
          throw new FirestoreUnavailableError(
            `Error persisting production event ${docId}: ${diagnostic.safeMessage}`,
            diagnostic,
            err
          );
        }
        console.error(`[FirestoreService] Error saving event ${docId}:`, diagnostic);
      }
    }

    return { isNew: !isExisting };
  }

  public async markEventDispatched(
    eventId: string,
    messageId?: string | number,
    options?: StorageWriteOptions
  ): Promise<void> {
    const client = await this.getClient();
    if (options?.production && (!client || !this.isConnected)) {
      throw new FirestoreUnavailableError('Cannot mark event dispatched: Firestore is unavailable.');
    }

    const memoryEvt = this.memoryEvents.get(eventId);
    if (memoryEvt) {
      memoryEvt.alreadyDispatched = true;
      memoryEvt.telegramDispatchedAt = new Date().toISOString();
      if (messageId) memoryEvt.telegramMessageId = String(messageId);
    }

    if (client) {
      try {
        const payload = sanitizeForFirestore({
          alreadyDispatched: true,
          telegramDispatchedAt: new Date().toISOString(),
          telegramMessageId: messageId ? String(messageId) : undefined,
        });
        await client
          .collection(FIRESTORE_COLLECTIONS.EVENTS)
          .doc(eventId)
          .set(payload, { merge: true });
      } catch (err: any) {
        const diagnostic = this.extractFirestoreErrorDetails(err, {
          operation: 'markEventDispatched',
          collection: FIRESTORE_COLLECTIONS.EVENTS,
          documentId: eventId,
        });
        if (options?.production) {
          throw new FirestoreUnavailableError(
            `Error marking event dispatched ${eventId}: ${diagnostic.safeMessage}`,
            diagnostic,
            err
          );
        }
        console.error(`[FirestoreService] Error marking event dispatched ${eventId}:`, diagnostic);
      }
    }
  }

  // ==========================================
  // 4. Telegram Deliveries & Atomic Concurrency Strategy
  // ==========================================

  // ==========================================
  // Poll cycle lock (prevents overlapping scheduler/manual runs across instances)
  // ==========================================
  private memoryPollLock: { owner: string; expiresAt: number } | null = null;

  /**
   * Acquires the single poll-cycle lock. The lock expires on its own (ttlMs) so a crashed
   * run cannot block collection forever. Returns false when another run holds a live lock.
   */
  public async acquirePollLock(owner: string, ttlMs: number, options?: StorageWriteOptions): Promise<boolean> {
    const client = await this.getClient();
    if (options?.production && (!client || !this.isConnected)) {
      throw new FirestoreUnavailableError('Cannot acquire poll lock: Firestore is unavailable.');
    }
    const now = Date.now();
    if (client && this.isConnected) {
      const ref = client.collection(FIRESTORE_COLLECTIONS.LOCKS).doc('poll');
      return client.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        const data = doc.exists ? (doc.data() as { owner?: string; expiresAt?: number }) : undefined;
        if (data?.owner && (data.expiresAt || 0) > now && data.owner !== owner) return false;
        tx.set(ref, { owner, acquiredAt: new Date(now).toISOString(), expiresAt: now + ttlMs });
        return true;
      });
    }
    if (this.memoryPollLock && this.memoryPollLock.expiresAt > now && this.memoryPollLock.owner !== owner) return false;
    this.memoryPollLock = { owner, expiresAt: now + ttlMs };
    return true;
  }

  private memoryOpsState = new Map<string, Record<string, unknown>>();

  /** Small operational state documents (e.g. consecutive poll failures). Memory fallback when Firestore is down. */
  public async getOpsState<T extends Record<string, unknown>>(key: string): Promise<T | null> {
    const client = await this.getClient();
    if (client && this.isConnected) {
      try {
        const doc = await client.collection(FIRESTORE_COLLECTIONS.OPS_STATE).doc(key).get();
        if (doc.exists) return doc.data() as T;
        return null;
      } catch (err: any) {
        console.warn('[FirestoreService] ops state read failed:', err?.code || err?.name || 'unknown');
      }
    }
    return (this.memoryOpsState.get(key) as T) || null;
  }

  public async setOpsState(key: string, data: Record<string, unknown>): Promise<void> {
    this.memoryOpsState.set(key, data);
    const client = await this.getClient();
    if (!client || !this.isConnected) return;
    try {
      await client.collection(FIRESTORE_COLLECTIONS.OPS_STATE).doc(key).set(sanitizeForFirestore(data));
    } catch (err: any) {
      console.warn('[FirestoreService] ops state write failed:', err?.code || err?.name || 'unknown');
    }
  }

  public async releasePollLock(owner: string): Promise<void> {
    if (this.memoryPollLock?.owner === owner) this.memoryPollLock = null;
    const client = await this.getClient();
    if (!client || !this.isConnected) return;
    try {
      const ref = client.collection(FIRESTORE_COLLECTIONS.LOCKS).doc('poll');
      await client.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        if (doc.exists && (doc.data() as { owner?: string }).owner === owner) {
          tx.set(ref, { owner: '', releasedAt: new Date().toISOString(), expiresAt: 0 });
        }
      });
    } catch (err: any) {
      // The lock expires by TTL anyway; never fail a finished cycle because release failed.
      console.warn('[FirestoreService] Poll lock release failed:', err?.code || err?.name || 'unknown');
    }
  }

  /** Pending reservations younger than this are treated as an in-flight send by another run. */
  public static readonly PENDING_LOCK_MS = 2 * 60 * 1000;
  /** Failed deliveries are retried on later cycles up to this many total attempts. */
  public static readonly MAX_DELIVERY_ATTEMPTS = 3;

  /**
   * Decides whether an existing delivery record blocks a new reservation.
   * A pending record older than the lock window means a previous run crashed or timed out
   * AFTER possibly sending — the Telegram API may already have delivered the message, so it
   * is held for manual review instead of being re-sent automatically (at-most-once policy).
   */
  public static evaluateExistingDelivery(
    existing: FirestoreTelegramDeliveryDoc
  ): 'ALREADY_SENT' | 'CONCURRENT_PENDING_LOCK' | 'STALE_PENDING_NEEDS_REVIEW' | 'MAX_ATTEMPTS_REACHED' | null {
    if (existing.status === 'sent' || existing.status === 'success') return 'ALREADY_SENT';
    if (existing.status === 'pending') {
      const ageMs = Date.now() - new Date(existing.createdAt || 0).getTime();
      return ageMs < FirestoreService.PENDING_LOCK_MS ? 'CONCURRENT_PENDING_LOCK' : 'STALE_PENDING_NEEDS_REVIEW';
    }
    if (existing.status === 'failed' && (existing.attempts || 1) >= FirestoreService.MAX_DELIVERY_ATTEMPTS) {
      return 'MAX_ATTEMPTS_REACHED';
    }
    return null;
  }

  /**
   * Atomic Delivery Reservation (Strict Ordering Step 2)
   *
   * Checks whether event was already sent or is currently being processed.
   * Atomically records status: 'pending' in telegramDeliveries.
   */
  public async reserveTelegramDeliveryPending(
    eventId: string,
    projectId: string,
    messageHash: string,
    importance?: number,
    options?: StorageWriteOptions
  ): Promise<{
    allowed: boolean;
    reason?: 'ALREADY_SENT' | 'CONCURRENT_PENDING_LOCK' | 'STALE_PENDING_NEEDS_REVIEW' | 'MAX_ATTEMPTS_REACHED' | 'RESERVED';
    deliveryId: string;
    existingDelivery?: FirestoreTelegramDeliveryDoc;
  }> {
    const client = await this.getClient();
    if (options?.production && (!client || !this.isConnected)) {
      throw new FirestoreUnavailableError(
        'Cannot reserve telegram delivery in production: Firestore is unavailable (Memory fallback strictly prohibited).'
      );
    }

    const deliveryId = `deliv_${eventId}`;
    const nowIso = new Date().toISOString();

    // 1. Live Firestore Atomic Transaction
    if (client && this.isConnected) {
      try {
        return await client.runTransaction(async (transaction) => {
          const delivRef = client.collection(FIRESTORE_COLLECTIONS.TELEGRAM_DELIVERIES).doc(deliveryId);
          const doc = await transaction.get(delivRef);

          if (doc.exists) {
            const existing = doc.data() as FirestoreTelegramDeliveryDoc;
            // If already sent, reject immediately
            if (existing.status === 'sent' || existing.status === 'success') {
              return { allowed: false, reason: 'ALREADY_SENT', deliveryId, existingDelivery: existing };
            }
            const blocked = FirestoreService.evaluateExistingDelivery(existing);
            if (blocked) return { allowed: false, reason: blocked, deliveryId, existingDelivery: existing };
          }
          const attempts = (doc.exists ? (doc.data() as FirestoreTelegramDeliveryDoc).attempts || 0 : 0) + 1;

          const pendingDoc: FirestoreTelegramDeliveryDoc = sanitizeForFirestore({
            id: deliveryId,
            eventId,
            projectId,
            status: 'pending',
            createdAt: nowIso,
            messageHash,
            chatId: process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHANNEL_ID || '',
            importance,
            attempts,
          });

          transaction.set(delivRef, pendingDoc, { merge: true });
          return { allowed: true, reason: 'RESERVED', deliveryId, existingDelivery: pendingDoc };
        });
      } catch (err: any) {
        const diagnostic = this.extractFirestoreErrorDetails(err, {
          operation: 'reserveTelegramDeliveryPending',
          collection: FIRESTORE_COLLECTIONS.TELEGRAM_DELIVERIES,
          documentId: deliveryId,
        });
        if (options?.production) {
          throw new FirestoreUnavailableError(
            `Error reserving telegram delivery ${deliveryId}: ${diagnostic.safeMessage}`,
            diagnostic,
            err
          );
        }
        throw err;
      }
    }

    // 2. Memory Store Atomic Simulation (for local testing / dev inspection only)
    const existingIndex = this.memoryDeliveries.findIndex((d) => d.eventId === eventId);
    if (existingIndex >= 0) {
      const existing = this.memoryDeliveries[existingIndex];
      if (existing.status === 'sent' || existing.status === 'success') {
        return { allowed: false, reason: 'ALREADY_SENT', deliveryId, existingDelivery: existing };
      }
      const blocked = FirestoreService.evaluateExistingDelivery(existing);
      if (blocked) return { allowed: false, reason: blocked, deliveryId, existingDelivery: existing };

      existing.status = 'pending';
      existing.createdAt = nowIso;
      existing.messageHash = messageHash;
      existing.attempts = (existing.attempts || 0) + 1;
      return { allowed: true, reason: 'RESERVED', deliveryId, existingDelivery: existing };
    }

    const pendingDoc: FirestoreTelegramDeliveryDoc = {
      id: deliveryId,
      eventId,
      projectId,
      status: 'pending',
      createdAt: nowIso,
      messageHash,
      chatId: process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHANNEL_ID || '',
      importance,
      attempts: 1,
    };
    this.memoryDeliveries.unshift(pendingDoc);
    this.memoryDeliveries.length = Math.min(this.memoryDeliveries.length, MEMORY_LIMITS.deliveries);
    return { allowed: true, reason: 'RESERVED', deliveryId, existingDelivery: pendingDoc };
  }

  /**
   * Finalize Delivery Result (Strict Ordering Step 4 / 5)
   *
   * Updates status to 'sent' on success, or 'failed' on error.
   */
  public async updateTelegramDeliveryResult(
    eventId: string,
    result: {
      success: boolean;
      sentAt: string;
      telegramMessageId?: string | number;
      error?: string;
      messageText?: string;
      messageHash?: string;
    },
    options?: StorageWriteOptions
  ): Promise<FirestoreTelegramDeliveryDoc> {
    const client = await this.getClient();
    if (options?.production && (!client || !this.isConnected)) {
      throw new FirestoreUnavailableError(
        'Cannot update telegram delivery in production: Firestore is unavailable.'
      );
    }

    const deliveryId = `deliv_${eventId}`;
    const nowIso = new Date().toISOString();
    const status: 'sent' | 'failed' = result.success ? 'sent' : 'failed';

    if (client && this.isConnected) {
      try {
        const delivRef = client.collection(FIRESTORE_COLLECTIONS.TELEGRAM_DELIVERIES).doc(deliveryId);
        const updateData: Partial<FirestoreTelegramDeliveryDoc> = sanitizeForFirestore({
          status,
          sentAt: result.success ? result.sentAt : undefined,
          failedAt: !result.success ? nowIso : undefined,
          telegramMessageId: result.telegramMessageId ? String(result.telegramMessageId) : undefined,
          error: result.error,
          messageText: result.messageText,
          messageHash: result.messageHash,
        });
        await delivRef.set(updateData, { merge: true });

        if (result.success) {
          await this.markEventDispatched(eventId, result.telegramMessageId, options);
        }
      } catch (err: any) {
        const diagnostic = this.extractFirestoreErrorDetails(err, {
          operation: 'updateTelegramDeliveryResult',
          collection: FIRESTORE_COLLECTIONS.TELEGRAM_DELIVERIES,
          documentId: deliveryId,
        });
        if (options?.production) {
          throw new FirestoreUnavailableError(
            `Error updating telegram delivery ${deliveryId}: ${diagnostic.safeMessage}`,
            diagnostic,
            err
          );
        }
        console.error(`[FirestoreService] Error updating delivery ${deliveryId}:`, diagnostic);
      }
    }

    // Memory sync for dashboard / inspection
    let memDoc = this.memoryDeliveries.find((d) => d.eventId === eventId);
    if (memDoc) {
      memDoc.status = status;
      if (result.success) {
        memDoc.sentAt = result.sentAt;
        memDoc.telegramMessageId = result.telegramMessageId;
      } else {
        memDoc.failedAt = nowIso;
        memDoc.error = result.error;
      }
    } else {
      memDoc = {
        id: deliveryId,
        eventId,
        projectId: 'unknown',
        status,
        createdAt: nowIso,
        sentAt: result.success ? result.sentAt : undefined,
        failedAt: !result.success ? nowIso : undefined,
        telegramMessageId: result.telegramMessageId,
        error: result.error,
        messageHash: result.messageHash || '',
        chatId: process.env.TELEGRAM_CHAT_ID || '',
      };
      this.memoryDeliveries.unshift(memDoc);
    }

    if (result.success && (!client || !this.isConnected)) {
      await this.markEventDispatched(eventId, result.telegramMessageId, options);
    }

    return memDoc;
  }

  public async isEventDelivered(eventId: string, options?: StorageWriteOptions): Promise<boolean> {
    const client = await this.getClient();
    if (options?.production && (!client || !this.isConnected)) {
      throw new FirestoreUnavailableError(
        'Cannot check duplicate delivery in production: Firestore is unavailable.'
      );
    }

    // 1. Check Firestore
    if (client && this.isConnected) {
      try {
        const delivDoc = await client
          .collection(FIRESTORE_COLLECTIONS.TELEGRAM_DELIVERIES)
          .doc(`deliv_${eventId}`)
          .get();

        if (delivDoc.exists) {
          const data = delivDoc.data() as FirestoreTelegramDeliveryDoc;
          if (data.status === 'sent' || data.status === 'success') return true;
          // Fresh pending = in-flight elsewhere; stale pending = outcome unknown (held for review).
          if (data.status === 'pending') return true;
        }

        const evtDoc = await client.collection(FIRESTORE_COLLECTIONS.EVENTS).doc(eventId).get();
        if (evtDoc.exists && (evtDoc.data() as FirestoreEventDoc).alreadyDispatched) {
          return true;
        }
        return false;
      } catch (err) {
        if (options?.production) {
          throw new FirestoreUnavailableError(`Error checking delivery status: ${err}`);
        }
      }
    }

    // 2. Check memory store for development
    const deliveredInMemory = this.memoryDeliveries.some(
      (d) =>
        d.eventId === eventId &&
        (d.status === 'sent' || d.status === 'success' || d.status === 'pending')
    );
    if (deliveredInMemory) return true;

    const memEvt = this.memoryEvents.get(eventId);
    return memEvt?.alreadyDispatched || false;
  }

  public async getTelegramDelivery(
    eventId: string,
    options?: StorageWriteOptions
  ): Promise<FirestoreTelegramDeliveryDoc | null> {
    const client = await this.getClient();
    const deliveryId = eventId.startsWith('deliv_') ? eventId : `deliv_${eventId}`;
    if (client) {
      try {
        let snap = await client
          .collection(FIRESTORE_COLLECTIONS.TELEGRAM_DELIVERIES)
          .doc(deliveryId)
          .get();
        if (!snap.exists) {
          snap = await client
            .collection(FIRESTORE_COLLECTIONS.TELEGRAM_DELIVERIES)
            .doc(eventId)
            .get();
        }
        if (snap.exists) {
          return snap.data() as FirestoreTelegramDeliveryDoc;
        }
      } catch (err) {
        if (options?.production) {
          throw new FirestoreUnavailableError(`Error fetching telegram delivery: ${err}`);
        }
      }
    }
    const mem = this.memoryDeliveries.find(
      (d) => d.eventId === eventId || d.id === deliveryId || d.id === eventId
    );
    return mem || null;
  }

  public async saveTelegramDelivery(
    delivery: FirestoreTelegramDeliveryDoc,
    options?: StorageWriteOptions
  ): Promise<void> {
    const docId = delivery?.id;
    if (!docId || typeof docId !== 'string' || docId.trim() === '') {
      throw new Error('Invalid delivery ID: must be a non-empty string');
    }

    const client = await this.getClient();
    if (options?.production && (!client || !this.isConnected)) {
      throw new FirestoreUnavailableError(
        'Cannot save telegram delivery in production: Firestore is unavailable.'
      );
    }

    const sanitizedDelivery = sanitizeForFirestore(delivery);
    this.memoryDeliveries.unshift(sanitizedDelivery);
    if (sanitizedDelivery.status === 'sent' || sanitizedDelivery.status === 'success') {
      await this.markEventDispatched(sanitizedDelivery.eventId, sanitizedDelivery.telegramMessageId, options);
    }

    if (client) {
      try {
        await client
          .collection(FIRESTORE_COLLECTIONS.TELEGRAM_DELIVERIES)
          .doc(docId)
          .set(sanitizedDelivery);
      } catch (err: any) {
        const diagnostic = this.extractFirestoreErrorDetails(err, {
          operation: 'saveTelegramDelivery',
          collection: FIRESTORE_COLLECTIONS.TELEGRAM_DELIVERIES,
          documentId: docId,
        });
        if (options?.production) {
          throw new FirestoreUnavailableError(
            `Error saving telegram delivery ${docId}: ${diagnostic.safeMessage}`,
            diagnostic,
            err
          );
        }
        console.error(`[FirestoreService] Error saving telegram delivery ${docId}:`, diagnostic);
      }
    }
  }

  public async getRecentEvents(limit = 30): Promise<FirestoreEventDoc[]> {
    const client = await this.getClient();
    if (client) {
      try {
        const snapshot = await client
          .collection(FIRESTORE_COLLECTIONS.EVENTS)
          .orderBy('lastSeenAt', 'desc')
          .limit(limit)
          .get();
        if (!snapshot.empty) {
          return snapshot.docs.map((d) => d.data() as FirestoreEventDoc);
        }
        return [];
      } catch (err) {
        console.error('[FirestoreService] Error getting events:', err);
      }
    }
    return Array.from(this.memoryEvents.values())
      .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
      .slice(0, limit);
  }

  public async getRecentDeliveries(limit = 20): Promise<FirestoreTelegramDeliveryDoc[]> {
    const client = await this.getClient();
    if (client) {
      try {
        const snapshot = await client
          .collection(FIRESTORE_COLLECTIONS.TELEGRAM_DELIVERIES)
          .orderBy('sentAt', 'desc')
          .limit(limit)
          .get();
        if (!snapshot.empty) {
          return snapshot.docs.map((d) => d.data() as FirestoreTelegramDeliveryDoc);
        }
      } catch (err) {
        console.error('[FirestoreService] Error getting deliveries:', err);
      }
    }
    return this.memoryDeliveries.slice(0, limit);
  }

  // ==========================================
  // 5. Collection Cycles Collection
  // ==========================================

  public async saveCollectionCycle(
    cycle: FirestoreCollectionCycleDoc,
    options?: StorageWriteOptions
  ): Promise<void> {
    const docId = cycle?.id;
    if (!docId || typeof docId !== 'string' || docId.trim() === '') {
      throw new Error('Invalid cycle ID: must be a non-empty string');
    }

    const client = await this.getClient();
    if (options?.production && (!client || !this.isConnected)) {
      throw new FirestoreUnavailableError(
        'Cannot persist collection cycle in production: Firestore is unavailable.'
      );
    }

    const sanitizedCycle = sanitizeForFirestore(cycle);
    this.memoryCycles.unshift(sanitizedCycle);
    this.memoryCycles.length = Math.min(this.memoryCycles.length, MEMORY_LIMITS.cycles);

    if (client) {
      try {
        await client
          .collection(FIRESTORE_COLLECTIONS.COLLECTION_CYCLES)
          .doc(docId)
          .set({ ...sanitizedCycle, expiresAt: ttlTimestamp(RETENTION_DAYS.collectionCycles) });
      } catch (err: any) {
        const diagnostic = this.extractFirestoreErrorDetails(err, {
          operation: 'saveCollectionCycle',
          collection: FIRESTORE_COLLECTIONS.COLLECTION_CYCLES,
          documentId: docId,
        });
        if (options?.production) {
          throw new FirestoreUnavailableError(
            `Error saving cycle ${docId}: ${diagnostic.safeMessage}`,
            diagnostic,
            err
          );
        }
        console.error(`[FirestoreService] Error saving cycle ${docId}:`, diagnostic);
      }
    }
  }

  public async getRecentCycles(limit = 10): Promise<FirestoreCollectionCycleDoc[]> {
    const client = await this.getClient();
    if (client) {
      try {
        const snapshot = await client
          .collection(FIRESTORE_COLLECTIONS.COLLECTION_CYCLES)
          .orderBy('startedAt', 'desc')
          .limit(limit)
          .get();
        if (!snapshot.empty) {
          return snapshot.docs.map((d) => d.data() as FirestoreCollectionCycleDoc);
        }
      } catch (err) {
        console.error('[FirestoreService] Error getting cycles:', err);
      }
    }
    return this.memoryCycles.slice(0, limit);
  }

  // ==========================================
  // 6. Area Developments Collection (Phase 4C)
  // ==========================================

  public async saveAreaDevelopment(
    dev: FirestoreAreaDevelopmentDoc,
    options?: StorageWriteOptions
  ): Promise<{ isNew: boolean }> {
    const docId = dev?.developmentId;
    if (!docId || typeof docId !== 'string' || docId.trim() === '') {
      throw new Error('Invalid developmentId: must be a non-empty string');
    }

    const client = await this.getClient();
    if (options?.production && (!client || !this.isConnected)) {
      throw new FirestoreUnavailableError('Cannot save area development in production: Firestore is unavailable.');
    }

    const isExistingInMemory = this.memoryAreaDevelopments.has(docId);
    const sanitizedDoc = sanitizeForFirestore(dev);
    this.memoryAreaDevelopments.set(docId, sanitizedDoc);

    if (client) {
      try {
        const docRef = client.collection(FIRESTORE_COLLECTIONS.AREA_DEVELOPMENTS).doc(docId);
        const existing = await docRef.get();
        if (existing.exists) {
          await docRef.set(sanitizedDoc, { merge: true });
          return { isNew: false };
        } else {
          await docRef.set(sanitizedDoc);
          return { isNew: true };
        }
      } catch (err: any) {
        const diagnostic = this.extractFirestoreErrorDetails(err, {
          operation: 'saveAreaDevelopment',
          collection: FIRESTORE_COLLECTIONS.AREA_DEVELOPMENTS,
          documentId: docId,
        });
        if (options?.production) {
          throw new FirestoreUnavailableError(
            `Error saving area development ${docId}: ${diagnostic.safeMessage}`,
            diagnostic,
            err
          );
        }
        console.error(`[FirestoreService] Error saving area development ${docId}:`, diagnostic);
      }
    }

    return { isNew: !isExistingInMemory };
  }

  public async getAreaDevelopments(projectId?: string): Promise<FirestoreAreaDevelopmentDoc[]> {
    const client = await this.getClient();
    if (client) {
      try {
        const snapshot = await client.collection(FIRESTORE_COLLECTIONS.AREA_DEVELOPMENTS).get();
        if (!snapshot.empty) {
          const allDocs = snapshot.docs.map((d) => d.data() as FirestoreAreaDevelopmentDoc);
          if (projectId) {
            return allDocs.filter((d) => d.affectedProjectIds?.includes(projectId));
          }
          return allDocs;
        }
      } catch (err) {
        console.error('[FirestoreService] Error fetching area developments from Firestore:', err);
      }
    }
    const memDocs = Array.from(this.memoryAreaDevelopments.values());
    if (projectId) {
      return memDocs.filter((d) => d.affectedProjectIds?.includes(projectId));
    }
    return memDocs;
  }

  public async seedAreaDevelopments(options?: StorageWriteOptions): Promise<{
    requested: number;
    created: number;
    skipped: number;
    failed: number;
    items: Array<{ developmentId: string; status: 'created' | 'skipped' | 'failed'; error?: string }>;
  }> {
    const results = {
      requested: AREA_DEVELOPMENTS_DATA.length,
      created: 0,
      skipped: 0,
      failed: 0,
      items: [] as Array<{ developmentId: string; status: 'created' | 'skipped' | 'failed'; error?: string }>,
    };

    for (const dev of AREA_DEVELOPMENTS_DATA) {
      try {
        const res = await this.saveAreaDevelopment(dev, options);
        if (res.isNew) {
          results.created++;
          results.items.push({ developmentId: dev.developmentId, status: 'created' });
        } else {
          results.skipped++;
          results.items.push({ developmentId: dev.developmentId, status: 'skipped' });
        }
      } catch (err: any) {
        results.failed++;
        results.items.push({ developmentId: dev.developmentId, status: 'failed', error: err?.message });
      }
    }

    return results;
  }

  // ==========================================
  // 7. Unit Types & Plan Versions Collection (Phase 4D)
  // ==========================================

  public async getPlanVersions(projectId?: string): Promise<FirestorePlanVersionDoc[]> {
    const client = await this.getClient();
    if (client) {
      try {
        const snapshot = await client.collection(FIRESTORE_COLLECTIONS.PLAN_VERSIONS).get();
        if (!snapshot.empty) {
          const allDocs = snapshot.docs.map((d) => d.data() as FirestorePlanVersionDoc);
          if (projectId) {
            return allDocs.filter((d) => d.projectId === projectId);
          }
          return allDocs;
        }
      } catch (err) {
        console.error('[FirestoreService] Error fetching plan versions from Firestore:', err);
      }
    }
    const memDocs = Array.from(this.memoryPlanVersions.values());
    if (projectId) {
      return memDocs.filter((d) => d.projectId === projectId);
    }
    return memDocs;
  }

  public async getUnitTypes(projectId?: string, areaGroup?: string): Promise<FirestoreUnitTypeDoc[]> {
    const client = await this.getClient();
    let unitDocs: FirestoreUnitTypeDoc[] = [];

    if (client) {
      try {
        const snapshot = await client.collection(FIRESTORE_COLLECTIONS.UNIT_TYPES).get();
        if (!snapshot.empty) {
          unitDocs = snapshot.docs.map((d) => d.data() as FirestoreUnitTypeDoc);
        }
      } catch (err) {
        console.error('[FirestoreService] Error fetching unit types from Firestore:', err);
      }
    }
    if (unitDocs.length === 0) {
      unitDocs = Array.from(this.memoryUnitTypes.values());
    }

    if (projectId) {
      unitDocs = unitDocs.filter((d) => d.projectId === projectId);
    }
    if (areaGroup) {
      unitDocs = unitDocs.filter((d) => d.areaGroup === areaGroup);
    }

    // Dynamic physical file check on static assets path
    return unitDocs.map((doc) => {
      const relPath = doc.sourceAsset?.assetPath || doc.sourceAsset?.imageUrl;
      let fileExists = false;
      if (relPath) {
        const cleanPath = relPath.startsWith('/') ? relPath.slice(1) : relPath;
        const localFilePath = path.join(process.cwd(), 'public', cleanPath);
        try {
          fileExists = fs.existsSync(localFilePath);
        } catch {
          fileExists = false;
        }
      }
      return {
        ...doc,
        sourceAsset: {
          ...doc.sourceAsset,
          fileExists,
          sourceAssetVerified: fileExists,
        },
      };
    });
  }

  public async getPlanAssets(projectId?: string): Promise<FirestorePlanAssetDoc[]> {
    const client = await this.getClient();
    if (client) {
      try {
        const snapshot = await client.collection(FIRESTORE_COLLECTIONS.PLAN_ASSETS).get();
        if (!snapshot.empty) {
          const allDocs = snapshot.docs.map((d) => d.data() as FirestorePlanAssetDoc);
          if (projectId) {
            return allDocs.filter((d) => d.projectId === projectId);
          }
          return allDocs;
        }
      } catch (err) {
        console.error('[FirestoreService] Error fetching plan assets from Firestore:', err);
      }
    }
    const memDocs = Array.from(this.memoryPlanAssets.values());
    if (projectId) {
      return memDocs.filter((d) => d.projectId === projectId);
    }
    return memDocs;
  }

  public async savePlanVersion(
    planDoc: FirestorePlanVersionDoc,
    options: StorageWriteOptions = {}
  ): Promise<{ success: boolean; id: string }> {
    const isProd = options.production || process.env.NODE_ENV === 'production';
    this.memoryPlanVersions.set(planDoc.planVersionId, { ...planDoc });

    const client = await this.getClient();
    if (!client) {
      if (isProd) {
        throw new FirestoreUnavailableError('Firestore unavailable for savePlanVersion', {
          operation: 'savePlanVersion',
          collection: FIRESTORE_COLLECTIONS.PLAN_VERSIONS,
          documentId: planDoc.planVersionId,
        });
      }
      return { success: true, id: planDoc.planVersionId };
    }

    try {
      const sanitized = sanitizeForFirestore(planDoc);
      await client
        .collection(FIRESTORE_COLLECTIONS.PLAN_VERSIONS)
        .doc(planDoc.planVersionId)
        .set(sanitized, { merge: true });
      return { success: true, id: planDoc.planVersionId };
    } catch (err: any) {
      console.error(`[FirestoreService] savePlanVersion error (${planDoc.planVersionId}):`, err);
      if (isProd) {
        throw new FirestoreUnavailableError(
          `Firestore savePlanVersion failed: ${err.message}`,
          {
            operation: 'savePlanVersion',
            collection: FIRESTORE_COLLECTIONS.PLAN_VERSIONS,
            documentId: planDoc.planVersionId,
            firestoreErrorCode: err?.code,
            firestoreErrorName: err?.name,
          },
          err
        );
      }
      return { success: true, id: planDoc.planVersionId };
    }
  }

  public async saveUnitType(
    unitDoc: FirestoreUnitTypeDoc,
    options: StorageWriteOptions = {}
  ): Promise<{ success: boolean; id: string }> {
    const isProd = options.production || process.env.NODE_ENV === 'production';
    this.memoryUnitTypes.set(unitDoc.unitTypeId, { ...unitDoc });

    const client = await this.getClient();
    if (!client) {
      if (isProd) {
        throw new FirestoreUnavailableError('Firestore unavailable for saveUnitType', {
          operation: 'saveUnitType',
          collection: FIRESTORE_COLLECTIONS.UNIT_TYPES,
          documentId: unitDoc.unitTypeId,
        });
      }
      return { success: true, id: unitDoc.unitTypeId };
    }

    try {
      const sanitized = sanitizeForFirestore(unitDoc);
      await client
        .collection(FIRESTORE_COLLECTIONS.UNIT_TYPES)
        .doc(unitDoc.unitTypeId)
        .set(sanitized, { merge: true });
      return { success: true, id: unitDoc.unitTypeId };
    } catch (err: any) {
      console.error(`[FirestoreService] saveUnitType error (${unitDoc.unitTypeId}):`, err);
      if (isProd) {
        throw new FirestoreUnavailableError(
          `Firestore saveUnitType failed: ${err.message}`,
          {
            operation: 'saveUnitType',
            collection: FIRESTORE_COLLECTIONS.UNIT_TYPES,
            documentId: unitDoc.unitTypeId,
            firestoreErrorCode: err?.code,
            firestoreErrorName: err?.name,
          },
          err
        );
      }
      return { success: true, id: unitDoc.unitTypeId };
    }
  }

  public async getSitePlans(projectId?: string): Promise<FirestoreSitePlanDoc[]> {
    const client = await this.getClient();
    if (client) {
      try {
        const snapshot = await client.collection(FIRESTORE_COLLECTIONS.SITE_PLANS).get();
        if (!snapshot.empty) {
          const allDocs = snapshot.docs.map((d) => d.data() as FirestoreSitePlanDoc);
          if (projectId) {
            return allDocs.filter((d) => d.projectId === projectId);
          }
          return allDocs;
        }
      } catch (err) {
        console.error('[FirestoreService] Error fetching site plans from Firestore:', err);
      }
    }
    const memDocs = Array.from(this.memorySitePlans.values());
    if (projectId) {
      return memDocs.filter((d) => d.projectId === projectId);
    }
    return memDocs;
  }

  public async getBuildings(sitePlanId?: string): Promise<FirestoreBuildingDoc[]> {
    const client = await this.getClient();
    if (client) {
      try {
        const snapshot = await client.collection(FIRESTORE_COLLECTIONS.BUILDINGS).get();
        if (!snapshot.empty) {
          const allDocs = snapshot.docs.map((d) => d.data() as FirestoreBuildingDoc);
          if (sitePlanId) {
            return allDocs.filter((d) => d.sitePlanId === sitePlanId);
          }
          return allDocs;
        }
      } catch (err) {
        console.error('[FirestoreService] Error fetching buildings from Firestore:', err);
      }
    }
    const memDocs = Array.from(this.memoryBuildings.values());
    if (sitePlanId) {
      return memDocs.filter((d) => d.sitePlanId === sitePlanId);
    }
    return memDocs;
  }

  public async saveSitePlan(
    sitePlanDoc: FirestoreSitePlanDoc,
    options: StorageWriteOptions = {}
  ): Promise<{ success: boolean; id: string }> {
    const isProd = options.production || process.env.NODE_ENV === 'production';
    this.memorySitePlans.set(sitePlanDoc.sitePlanId, { ...sitePlanDoc });

    const client = await this.getClient();
    if (!client) {
      if (isProd) {
        throw new FirestoreUnavailableError('Firestore unavailable for saveSitePlan', {
          operation: 'saveSitePlan',
          collection: FIRESTORE_COLLECTIONS.SITE_PLANS,
          documentId: sitePlanDoc.sitePlanId,
        });
      }
      return { success: true, id: sitePlanDoc.sitePlanId };
    }

    try {
      const sanitized = sanitizeForFirestore(sitePlanDoc);
      await client
        .collection(FIRESTORE_COLLECTIONS.SITE_PLANS)
        .doc(sitePlanDoc.sitePlanId)
        .set(sanitized, { merge: true });
      return { success: true, id: sitePlanDoc.sitePlanId };
    } catch (err: any) {
      console.error(`[FirestoreService] saveSitePlan error (${sitePlanDoc.sitePlanId}):`, err);
      if (isProd) {
        throw new FirestoreUnavailableError(
          `Firestore saveSitePlan failed: ${err.message}`,
          {
            operation: 'saveSitePlan',
            collection: FIRESTORE_COLLECTIONS.SITE_PLANS,
            documentId: sitePlanDoc.sitePlanId,
            firestoreErrorCode: err?.code,
            firestoreErrorName: err?.name,
          },
          err
        );
      }
      return { success: true, id: sitePlanDoc.sitePlanId };
    }
  }

  public async saveBuilding(
    buildingDoc: FirestoreBuildingDoc,
    options: StorageWriteOptions = {}
  ): Promise<{ success: boolean; id: string }> {
    const isProd = options.production || process.env.NODE_ENV === 'production';
    this.memoryBuildings.set(buildingDoc.buildingId, { ...buildingDoc });

    const client = await this.getClient();
    if (!client) {
      if (isProd) {
        throw new FirestoreUnavailableError('Firestore unavailable for saveBuilding', {
          operation: 'saveBuilding',
          collection: FIRESTORE_COLLECTIONS.BUILDINGS,
          documentId: buildingDoc.buildingId,
        });
      }
      return { success: true, id: buildingDoc.buildingId };
    }

    try {
      const sanitized = sanitizeForFirestore(buildingDoc);
      await client
        .collection(FIRESTORE_COLLECTIONS.BUILDINGS)
        .doc(buildingDoc.buildingId)
        .set(sanitized, { merge: true });
      return { success: true, id: buildingDoc.buildingId };
    } catch (err: any) {
      console.error(`[FirestoreService] saveBuilding error (${buildingDoc.buildingId}):`, err);
      if (isProd) {
        throw new FirestoreUnavailableError(
          `Firestore saveBuilding failed: ${err.message}`,
          {
            operation: 'saveBuilding',
            collection: FIRESTORE_COLLECTIONS.BUILDINGS,
            documentId: buildingDoc.buildingId,
            firestoreErrorCode: err?.code,
            firestoreErrorName: err?.name,
          },
          err
        );
      }
      return { success: true, id: buildingDoc.buildingId };
    }
  }

  public async seedChokjin3ProposalPlans(options: StorageWriteOptions = {}): Promise<{
    planVersionId: string;
    sitePlanId: string;
    seededUnitTypesCount: number;
    seededBuildingsCount: number;
    totalUnitsInPlanSet: number;
    confirmationStatus: string;
    verificationStatus: string;
  }> {
    // 1. Save planVersion
    await this.savePlanVersion(CHOKJIN3_PLAN_VERSION, options);

    // 2. Save sitePlan (Phase 4D-5D SSOT)
    await this.saveSitePlan(CHOKJIN3_SITE_PLAN, options);

    // 3. Save 18 buildings (Phase 4D-5D SSOT)
    let seededBuildings = 0;
    for (const bldg of CHOKJIN3_BUILDINGS) {
      await this.saveBuilding(bldg, options);
      seededBuildings++;
    }

    // 4. Save all 39 unitTypes with mapping data
    let seededCount = 0;
    for (const unit of CHOKJIN3_UNIT_TYPES) {
      await this.saveUnitType(unit, options);
      seededCount++;
    }

    return {
      planVersionId: CHOKJIN3_PLAN_VERSION.planVersionId,
      sitePlanId: CHOKJIN3_SITE_PLAN.sitePlanId,
      seededUnitTypesCount: seededCount,
      seededBuildingsCount: seededBuildings,
      totalUnitsInPlanSet: CHOKJIN3_PLAN_VERSION.totalUnitsInPlanSet,
      confirmationStatus: CHOKJIN3_PLAN_VERSION.confirmationStatus,
      verificationStatus: CHOKJIN3_PLAN_VERSION.verificationStatus,
    };
  }

  // ==========================================
  // 8. Dashboard Aggregations
  // ==========================================

  public async getDashboardData() {
    const [projects, recentEvents, documents, deliveries, cycles, areaDevelopments, planVersions, unitTypes] = await Promise.all([
      this.getAllProjects(),
      this.getRecentEvents(100),
      this.getRecentDocuments(100),
      this.getRecentDeliveries(50),
      this.getRecentCycles(10),
      this.getAreaDevelopments(),
      this.getPlanVersions(),
      this.getUnitTypes(),
    ]);

    const events = mergeGwacheonHistory(recentEvents);
    const now = Date.now();
    const past24h = now - 24 * 60 * 60 * 1000;

    const projectCards = projects.map((p) => {
      const pEvents = events.filter((e) => e.projectId === p.id);
      const topEvent = pEvents[0] || null;
      const recent24hArticles = documents.filter(
        (d) =>
          d.matchedProjectIds.includes(p.id) &&
          new Date(d.discoveredAt || d.publishedAt).getTime() >= past24h
      ).length;

      const pDeliveries = deliveries.filter(
        (d) => d.projectId === p.id && (d.status === 'sent' || d.status === 'success')
      );
      const latestDelivery = pDeliveries[0] || null;

      return {
        project: p,
        projectId: p.id,
        name: p.name,
        district: p.district,
        stage: resolveProjectStatutoryStage(p.id, pEvents).currentStage,
        nextStage: resolveProjectStatutoryStage(p.id, pEvents).nextStage,
        topEvent,
        totalEvents: pEvents.length,
        recent24hArticles,
        articlesLast24h: recent24hArticles,
        telegramDispatchedCount: pDeliveries.length,
        latestDeliveryAt: latestDelivery?.sentAt || null,
        officialApiStatus: cycles[0]?.officialApiStatus === 'active' ? '공식 API 정상 수집'
          : cycles[0]?.officialApiStatus === 'failed' ? '공식 API 수집 실패 (수집 기록 확인)'
          : cycles[0]?.officialApiStatus === 'unavailable' ? '공식 API 사용 불가'
          : cycles[0]?.officialApiStatus === 'disabled' ? '공식 API 비활성 (설정·인증키 확인)'
          : '공식 API 상태 미확인 (수집 실행 필요)',
      };
    });

    return {
      status: this.getConnectionStatus(),
      projectCards,
      events,
      documents,
      deliveries,
      areaDevelopments,
      planVersions,
      unitTypes,
      latestCycle: cycles[0] || null,
      recentCycles: cycles,
    };
  }

}

