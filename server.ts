import { refreshApartmentFloorPlans, readApartmentFloorPlans } from './src/housing/apartmentFloorPlanStore.ts';
import { createRuntimeApartmentBudgetService } from './src/housing/apartmentBudgetRuntime.ts';
import { createApartmentTradeHistoryHandler } from './src/housing/apartmentTradeHistoryApi.ts';
import { createBusanPriceHandler } from './src/housing/busanPriceApi.ts';
import {costHttpTelemetry} from './src/utils/costTelemetry';
import {NewsBodyReader,firestoreNewsBodyCache} from './src/news/newsBodyReader';
import {FirestoreAnalysisQueue} from './src/queue/analysisQueue';
import {AttachmentReader,firestoreAttachmentCache} from './src/attachments/attachmentReader';
import { createApiSecurity, SECURITY_VERSION } from './src/security/apiSecurity.ts';
import { GwacheonCityNoticeCollector } from './src/collector/officialCollector';
import { existsSync } from 'node:fs';
import { AssociationNoticeCollector } from './src/collector/associationCollector';
import { ANALYSIS_VERSION, GEMINI_ANALYSIS_SETTINGS, resolveGeminiModel } from './src/analyzer/geminiAnalyzer';
import { TtlCache, toPublicOverview, publicErrorBody } from './src/utils/publicApi.ts';
import { capCollectionCycleDoc } from './src/storage/cycleDocLimits.ts';
import { recordPollOutcome } from './src/notifier/pollHealthMonitor.ts';
import { resolveWebpSibling } from './src/utils/planAssets.ts';
import compression from 'compression';
/**
 * Busan Redevelopment News Monitor - Server Entrypoint
 * Express + Vite Full-stack architecture
 * 
 * 시스템 구조:
 * Cloud Scheduler (매일 08:00 KST 1회) -> Cloud Run (/api/jobs/poll) -> 수집 -> 판별 -> Gemini -> 이벤트 병합 -> Firestore -> Telegram
 * 
 * 중요 원칙:
 * - ENABLE_INTERNAL_SCHEDULER=false (내부 setInterval 사용 금지)
 * - Phase 1: 실제 Cloud Run 배포, Cloud Scheduler 생성, Firestore 운영 데이터 쓰기, Telegram 실제 발송은 하지 않음
 */

import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { OfficialNoticeCollector, BusanCityNoticeCollector, getKstDateString } from './src/collector/officialCollector.ts';
import { CollectionPipeline } from './src/pipeline/collectionPipeline.ts';
import { REDEVELOPMENT_SEED_PROJECTS, defaultRegistry } from './src/registry/redevelopmentRegistry.ts';
import { ALL_ANALYSIS_CATEGORIES, TELEGRAM_MIN_IMPORTANCE_DEFAULT } from './src/types/redevelopment.ts';
import { FirestoreService, FirestoreUnavailableError, RETENTION_DAYS, ttlTimestamp } from './src/storage/firestoreService.ts';
import { TelegramNotifier } from './src/notifier/telegramNotifier.ts';
import { FirestoreCollectionCycleDoc } from './src/schema/firestoreSchema.ts';
import { evaluateProductionReadiness, createPreviewReadOnlyMiddleware, resolvePreviewConfig } from './src/storage/readinessService.ts';
import { FIRESTORE_COLLECTIONS } from './src/schema/firestoreSchema.ts';

dotenv.config();

const app = express();
// Prioritize Cloud Run injected PORT environment variable with fallback to 3000
const PORT = Number(process.env.PORT) || 3000;

const apiSecurity = createApiSecurity({ production: process.env.NODE_ENV === 'production', secret: () => process.env.POLL_JOB_SECRET || process.env.CRON_SECRET });
app.disable('x-powered-by');
app.use(costHttpTelemetry());
// JSON and HTML compress 5-10x; images are already compressed and skipped by the filter.
app.use(compression());
// This guard must precede EVERY API route, including live upstream diagnostics.
app.use((req, res, next) => req.path.toLowerCase().startsWith('/api/') ? apiSecurity(req, res, next) : next());

app.use(express.json({ limit: '100kb' }));
// Read-only upstream diagnostics. No Firestore, Gemini or Telegram calls.
app.get('/api/official/diagnostics', async (req, res) => {
  const date = String(req.query.date || getKstDateString(-1));
  const projectId = String(req.query.projectId || 'udong-3');
  const project = REDEVELOPMENT_SEED_PROJECTS.find(p => p.id === projectId);
  if (!/^\d{8}$/.test(date) || !project) {
    res.status(400).json({ error: 'INVALID_DATE_OR_PROJECT' }); return;
  }
  res.setHeader('Cache-Control', 'no-store');
  try {
  if(req.query.source==='gwacheon-city') {
    const result=await new GwacheonCityNoticeCollector().fetchForProjects(REDEVELOPMENT_SEED_PROJECTS);
    res.json({revision:'gwacheon-city-20261014-v2',readOnly:true,savedToDatabase:false,success:!result.error,error:result.error,pagesRead:result.pagesRead,returnedCount:result.items.length,matchedItems:result.items.map(i=>({projectId:i.projectId,title:i.title,date:i.publishedAt,url:i.sourceUrl,detailVerified:i.detailVerified,attachmentUrls:i.attachmentUrls}))});return;
  }
  if (req.query.source === 'association') {
    const result = await new AssociationNoticeCollector().fetchForProject(project);
    res.json({revision:'association-board-20261014-v3',readOnly:true,savedToDatabase:false,
      projectId,tlsTrust:{nodeVersion:process.version,systemCaRequested:process.env.NODE_USE_SYSTEM_CA==='1',extraCaConfigured:Boolean(process.env.NODE_EXTRA_CA_CERTS),extraCaFilePresent:Boolean(process.env.NODE_EXTRA_CA_CERTS && existsSync(process.env.NODE_EXTRA_CA_CERTS)),certificateValidationEnabled:process.env.NODE_TLS_REJECT_UNAUTHORIZED!=='0'},configured:result.configured,success:result.configured && !result.error,
      error:result.error,pagesRead:result.pagesRead || 0,returnedCount:result.items.length,
      matchedItems:result.items.map(item=>({title:item.title,publishedAt:item.publishedAt,sourceUrl:item.sourceUrl,detailVerified:item.detailVerified}))}); return;
  }
  if (req.query.source === 'city') {
    const result = await new BusanCityNoticeCollector().fetchForProjects([project]);
    res.json({revision:'city-board-20261013-v2', readOnly:true, savedToDatabase:false,
      projectId, lookbackDays:7, success:!result.error, error:result.error,
      returnedCount:result.items.length, matchedItems:result.items}); return;
  }
  const collector = new OfficialNoticeCollector();
  const result = await collector.fetchAllNoticesForDate(date, { timeoutMs: 8000 });
  res.json({ revision: 'saeol-fields-20261012-v2', readOnly: true,
    savedToDatabase: false, runtime: process.env.NODE_ENV || 'development',
    queryDate: date, projectId, success: result.success, httpStatus: result.httpStatus,
    resultCode: result.resultCode, totalCount: result.totalCount,
    returnedCount: result.items.length, rawFieldNames: result.rawFieldNames,
    notices: result.items.map(raw => ({
      title: String(raw.ttlNm || raw.ancmntNm || raw.title || raw.sj || raw.ancmntTitle || ''),
      number: String(raw.mngNo || raw.ancmntNo || raw.manageNo || ''),
      date: String(raw.pbltnYmd || ''), department: String(raw.tkcgDeptNm || '')
    })),
    matchedItems: collector.filterNoticesForProject(result.items, project)
  });
  } catch (err) {
    console.error('[Diagnostics] failed:', (err as any)?.name, (err as any)?.message);
    if (!res.headersSent) res.status(502).json({ error: 'DIAGNOSTICS_FAILED' });
  }
});

app.get('/api/housing/busan-prices', createBusanPriceHandler());
const apartmentBudget = createRuntimeApartmentBudgetService(process.env);
app.get('/api/housing/apartment-budget', apartmentBudget.handle);
app.get('/api/housing/apartment-trade-history', createApartmentTradeHistoryHandler());

app.get('/api/housing/floor-plans/raemian-sur', readApartmentFloorPlans);

async function refreshHousingData() {
  const trades = apartmentBudget.refreshTrades();
  const floorPlans = process.env.IMPORT_FLOOR_PLANS_ON_POLL === 'true'
    ? refreshApartmentFloorPlans()
    : Promise.resolve({ skipped: true, reason: 'FLOOR_PLAN_IMPORT_DISABLED' });
  return Promise.allSettled([trades, floorPlans]);
}

// Optional development preview: proxies public reads to PREVIEW_UPSTREAM_ORIGIN, blocks writes.
// Opt-in via PREVIEW_MODE=true (never active when NODE_ENV=production).
const previewConfig = resolvePreviewConfig();
app.use('/api', createPreviewReadOnlyMiddleware(previewConfig.enabled, previewConfig.upstreamOrigin));
console.log('[PREVIEW] Read-only production proxy:', previewConfig.enabled ? previewConfig.upstreamOrigin || 'NOT CONFIGURED' : 'off');

// Phase 4D-4C: Serve plan assets with JFIF MIME support
const PLAN_ASSET_ROOT = path.join(process.cwd(), 'public/assets/plans');
app.use('/assets/plans', (req, res, next) => {
  const lower = req.path.toLowerCase();
  if (/\.(jpe?g|jfif|png)$/.test(lower)) {
    res.setHeader('Vary', 'Accept');
    // Pre-built WebP sibling (<name>.<ext>.webp), about half the size, for browsers that accept it.
    if (/\bimage\/webp\b/.test(String(req.headers.accept || ''))) {
      const webp = resolveWebpSibling(PLAN_ASSET_ROOT, req.path);
      if (webp) { req.url = webp; next(); return; }
    }
  }
  if (lower.endsWith('.jfif')) {
    res.setHeader('Content-Type', 'image/jpeg');
  }
  next();
}, express.static(PLAN_ASSET_ROOT, {
  // Plan images change rarely; one day of browser/CDN caching, revalidated after that.
  maxAge: '1d',
}));

// Startup Diagnostic Logging (Safe: Zero Secret Leakage)
console.log('====================================================');
console.log('[STARTUP] Busan Redevelopment News Monitor Service');
console.log(`[STARTUP] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`[STARTUP] Target Port: ${PORT} (process.env.PORT: ${process.env.PORT ?? 'undefined'})`);
console.log(`[STARTUP] Bind Address: 0.0.0.0`);
console.log(`[STARTUP] Runtime Module: ${typeof __dirname !== 'undefined' ? 'CommonJS (bundled)' : 'ES Modules'}`);
console.log(`[STARTUP] Firestore Configured: ${Boolean(process.env.FIRESTORE_DATABASE_ID || process.env.GOOGLE_APPLICATION_CREDENTIALS)}`);
console.log(`[STARTUP] Gemini Configured: ${Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '')}`);
console.log(`[STARTUP] Telegram Configured: ${Boolean(process.env.TELEGRAM_BOT_TOKEN && (process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHANNEL_ID))}`);
console.log(`[STARTUP] Poll Job Secret Configured: ${Boolean(process.env.POLL_JOB_SECRET || process.env.CRON_SECRET)}`);
console.log('====================================================');

const pipeline = new CollectionPipeline();
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
// Public read endpoints change only when a collection cycle runs (once a day) or data is seeded;
// both clear this cache, so a long TTL removes most Firestore reads without serving stale data.
const publicReadCache = new TtlCache(Number(process.env.PUBLIC_CACHE_TTL_MS) || 30 * 60_000);
const aiAnalysisInfo = () => ({ version: ANALYSIS_VERSION, model: resolveGeminiModel(), ...GEMINI_ANALYSIS_SETTINGS });
// Upper bound for one polling cycle; the lock expires after this even if the instance dies.
const POLL_LOCK_TTL_MS = Number(process.env.POLL_LOCK_TTL_MS) || 15 * 60_000;

class PollInProgressError extends Error {
  constructor() { super('POLL_ALREADY_RUNNING'); this.name = 'PollInProgressError'; }
}

/** Logs the real error server-side and answers public clients with a fixed code only. */
function sendPublicError(res: express.Response, code: string, err: unknown) {
  console.error(`[PublicAPI] ${code}:`, (err as any)?.name, (err as any)?.message);
  res.setHeader('Cache-Control', 'no-store');
  res.status(500).json(publicErrorBody(code));
}
const officialCollector = new OfficialNoticeCollector();
const firestoreService = new FirestoreService();
const telegramNotifier = new TelegramNotifier();

// Scheduler Configuration Enforcement
const ENABLE_INTERNAL_SCHEDULER = process.env.ENABLE_INTERNAL_SCHEDULER === 'true';
if (ENABLE_INTERNAL_SCHEDULER) {
  console.warn(
    '[ARCHITECTURAL WARNING] ENABLE_INTERNAL_SCHEDULER is set to true, but project principles mandate FALSE. Forcing internal scheduler to OFF. External Cloud Scheduler will invoke /api/jobs/poll.'
  );
} else {
  console.log(
    '[SCHEDULER CONFIG] Internal setInterval is DISABLED (ENABLE_INTERNAL_SCHEDULER=false). External Cloud Scheduler integration configured for /api/jobs/poll.'
  );
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

/**
 * Phase 3B: Production Readiness Assessment Helper
 * Evaluates production readiness and returns status without exposing secret values.
 */
export async function getProductionReadiness(fsService = firestoreService) {
  return evaluateProductionReadiness(fsService, telegramNotifier, officialCollector);
}

/**
 * Health & Readiness check for Cloud Run & Container orchestrators
 */
app.get('/api/health', async (req, res) => {
  const readiness = await getProductionReadiness();
  res.json({
    status: 'ok',
    ...readiness,
  });
});

/**
 * Phase 3B: Dedicated Production Status & Readiness Endpoints
 * Provides complete deployment readiness inspection with zero secret leakage.
 */
app.get('/api/analysis-queue',async(_req,res)=>{
  try{const stats=await publicReadCache.get('analysis-queue:stats',async()=>{const db=await firestoreService.getClient();if(!db)throw Error('QUEUE_UNAVAILABLE');return new FirestoreAnalysisQueue(db).stats();});res.json({stats});}
  catch{res.status(503).json({error:'대기열 상태를 확인하지 못했습니다.'});}
});
app.post('/api/analysis-queue/:id/retry',async(req,res)=>{
  if(!/^[a-f0-9]{64}$/.test(req.params.id))return res.status(400).json({error:'INVALID_QUEUE_ID'});
  const db=await firestoreService.getClient();if(!db)return res.status(503).json({error:'QUEUE_UNAVAILABLE'});
  const ref=db.collection('analysisQueue').doc(req.params.id);
  try{const result=await db.runTransaction(async tx=>{const snap=await tx.get(ref),data=snap.data();if(!data)return 404;if(!['retry','needs_review'].includes(data.state))return 409;tx.update(ref,{state:'pending',attempts:0,nextAttemptAt:Date.now(),updatedAt:Date.now()});return 200;});publicReadCache.clear();return res.status(result).json({success:result===200});}
  catch{return res.status(503).json({error:'QUEUE_RETRY_FAILED'});}
});

app.get('/api/status', async (req, res) => {
  const readiness = await getProductionReadiness();
  res.json({ ...readiness, securityVersion: SECURITY_VERSION, aiAnalysis: aiAnalysisInfo() });
});

app.get('/api/readiness', async (req, res) => {
  const readiness = await getProductionReadiness();
  const statusCode = readiness.readyForProduction ? 200 : 503;
  res.status(statusCode).json({ ...readiness, aiAnalysis: aiAnalysisInfo() });
});

/**
 * Redevelopment Projects Registry API
 */
app.get('/api/registry', (req, res) => {
  const projects = defaultRegistry.getAllActiveProjects();
  res.json({
    total: projects.length,
    projects,
  });
});

/**
 * Standard Taxonomy & Policy API
 */
app.get('/api/taxonomy', (req, res) => {
  res.json({
    categories: ALL_ANALYSIS_CATEGORIES,
    importanceScale: [
      { level: 5, label: '결정적 변화', description: '시공사 교체/선정, 인허가 취소/완료, 공사중단 등', telegramAlert: true },
      { level: 4, label: '주요 사업 변곡점', description: '공사비 분쟁, 정비계획 변경, 핵심 총회 등', telegramAlert: true },
      { level: 3, label: '일반 사업 진척', description: '통상 공람, 정기총회 공고, 일반 인허가 신청 등', telegramAlert: false },
      { level: 2, label: '통상 보도/시황', description: '인근 시세 동향, 종합 부동산 기사 내 단순 언급', telegramAlert: false },
      { level: 1, label: '단순 언급/노이즈', description: '단순 나열, 배경 설명 등', telegramAlert: false },
    ],
    telegramMinImportance: TELEGRAM_MIN_IMPORTANCE_DEFAULT,
    sourceTiers: [
      { tier: 'official', label: '공식 행정자료', examples: ['부산광역시 고시', '부산진구청 고시', '해운대구청 고시'], status: process.env.ENABLE_OFFICIAL_API === 'false' ? '설정에서 비활성' : !process.env.DATA_GO_KR_API_KEY?.trim() ? '인증키 미설정' : '설정 완료 (수집 결과는 대시보드 확인)' },
      { tier: 'news', label: '언론 보도 (Google News RSS)', examples: ['부산일보', '국제신문', '연합뉴스', '주요 경제지'], status: '운영 활성' },
    ],
    deduplicationStrategy: 'event_cluster_signature_merging',
  });
});

/**
 * Storage & Dashboard Overview API
 */
app.get('/api/storage/overview', async (req, res) => {
  try {
    const data = await publicReadCache.get('overview', async () => toPublicOverview(await firestoreService.getDashboardData()));
    res.json(data);
  } catch (err: any) {
    sendPublicError(res, 'STORAGE_OVERVIEW_FAILED', err);
  }
});

/**
 * Phase 4C: Area Developments API
 */
app.get('/api/developments', async (req, res) => {
  try {
    const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
    const developments = await publicReadCache.get(`developments:${projectId || ''}`, () => firestoreService.getAreaDevelopments(projectId));
    res.json({
      total: developments.length,
      projectId: projectId || 'all',
      developments,
    });
  } catch (err: any) {
    sendPublicError(res, 'FETCH_DEVELOPMENTS_FAILED', err);
  }
});

app.post('/api/developments/seed', async (req, res) => {
  try {
    const result = await firestoreService.seedAreaDevelopments({ production: IS_PRODUCTION });
    publicReadCache.clear();
    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Seed developments failed: ${err.message}` });
  }
});

/**
 * Phase 4D: Unit Plans & Versions API
 */
app.get('/api/plans', async (req, res) => {
  try {
    const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
    const [planVersions, planAssets] = await publicReadCache.get(`plans:${projectId || ''}`, () =>
      Promise.all([firestoreService.getPlanVersions(projectId), firestoreService.getPlanAssets(projectId)]));
    res.json({
      total: planVersions.length,
      projectId: projectId || 'all',
      planVersions,
      planAssets,
    });
  } catch (err: any) {
    sendPublicError(res, 'FETCH_PLANS_FAILED', err);
  }
});

app.get('/api/unit-types', async (req, res) => {
  try {
    const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
    const areaGroup = req.query.areaGroup ? String(req.query.areaGroup) : undefined;
    const unitTypes = await publicReadCache.get(`unitTypes:${projectId || ''}:${areaGroup || ''}`, () => firestoreService.getUnitTypes(projectId, areaGroup));
    res.json({
      total: unitTypes.length,
      projectId: projectId || 'all',
      areaGroup: areaGroup || 'all',
      unitTypes,
    });
  } catch (err: any) {
    sendPublicError(res, 'FETCH_UNIT_TYPES_FAILED', err);
  }
});

/**
 * Phase 4D-5D: Site Plans and Buildings Endpoints
 */
app.get('/api/site-plans', async (req, res) => {
  try {
    const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
    const sitePlans = await publicReadCache.get(`sitePlans:${projectId || ''}`, () => firestoreService.getSitePlans(projectId));
    res.json({
      total: sitePlans.length,
      projectId: projectId || 'all',
      sitePlans,
    });
  } catch (err: any) {
    sendPublicError(res, 'FETCH_SITE_PLANS_FAILED', err);
  }
});

app.get('/api/buildings', async (req, res) => {
  try {
    const sitePlanId = req.query.sitePlanId ? String(req.query.sitePlanId) : undefined;
    const buildings = await publicReadCache.get(`buildings:${sitePlanId || ''}`, () => firestoreService.getBuildings(sitePlanId));
    res.json({
      total: buildings.length,
      sitePlanId: sitePlanId || 'all',
      buildings,
    });
  } catch (err: any) {
    sendPublicError(res, 'FETCH_BUILDINGS_FAILED', err);
  }
});

/**
 * Phase 4D-4: Idempotent Plan Versions & Unit Types Seeding
 */
app.post('/api/plans/seed', async (req, res) => {
  try {
    const result = await firestoreService.seedChokjin3ProposalPlans();
    publicReadCache.clear();
    res.json({
      success: true,
      ...result,
      discrepancyNotice: '조합 평면자료 합계와 사업 총세대수 차이 원인 확인 필요',
      sourceType: 'association',
      confirmationStatus: 'proposal',
      verificationStatus: 'verified',
    });
  } catch (err: any) {
    res.status(500).json({ error: `Seed plans failed: ${err.message}` });
  }
});

app.post('/api/plan-versions', async (req, res) => {
  try {
    const planDoc = req.body;
    if (!planDoc || !planDoc.planVersionId) {
      return res.status(400).json({ error: 'Missing planVersionId in body' });
    }
    const result = await firestoreService.savePlanVersion(planDoc);
    publicReadCache.clear();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: `Save plan version failed: ${err.message}` });
  }
});

app.post('/api/unit-types', async (req, res) => {
  try {
    const unitDoc = req.body;
    if (!unitDoc || !unitDoc.unitTypeId) {
      return res.status(400).json({ error: 'Missing unitTypeId in body' });
    }
    const result = await firestoreService.saveUnitType(unitDoc);
    publicReadCache.clear();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: `Save unit type failed: ${err.message}` });
  }
});

/**
 * Core Production Polling Logic (shared between /api/jobs/poll and manual /api/pipeline/run)
 */
async function executeProductionPollingCycle(options: {
  source: 'scheduler' | 'manual';
  enableTelegram: boolean;
  production?: boolean;
}) {
  // Any run on a production server (scheduler or manual button) is held to the same
  // fail-closed rules: no memory fallback, no Telegram without durable delivery records.
  const isProduction = options.production ?? (options.source === 'scheduler' || IS_PRODUCTION);

  // Strict Fail-Closed Check for Production runs
  if (isProduction) {
    const fsHealth = await firestoreService.checkReady();
    if (!fsHealth.ready) {
      throw new Error(
        `[Fail-Closed] Production polling aborted: Firestore unavailable (${fsHealth.error}). Memory fallback is strictly prohibited.`
      );
    }
  }

  const lockOwner = `${options.source}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const acquired = await firestoreService.acquirePollLock(lockOwner, POLL_LOCK_TTL_MS, { production: isProduction });
  if (!acquired) throw new PollInProgressError();
  try {
    return await runPollingCycleLocked(isProduction, options.enableTelegram);
  } finally {
    await firestoreService.releasePollLock(lockOwner);
    publicReadCache.clear();
  }
}

async function runPollingCycleLocked(isProduction: boolean, enableTelegram: boolean) {
  const startedAt = new Date().toISOString();
  const existingEvents = await firestoreService.getRecentEvents(50);
  const activeProjects = defaultRegistry.getAllActiveProjects();

  const queueDb=await firestoreService.getClient();
  if(!queueDb)throw Error('ANALYSIS_QUEUE_UNAVAILABLE');
  const workQueue=new FirestoreAnalysisQueue(queueDb);
  // Persist all eligible work before analysis.
  const result = await pipeline.run({
    projects: activeProjects,
    workQueue,
    newsReader:new NewsBodyReader(firestoreNewsBodyCache(queueDb)),attachmentReader:new AttachmentReader(firestoreAttachmentCache(queueDb)),
    analysisCache: {
      get: async (key) => {
        const client = await firestoreService.getClient();
        if (!client) throw new Error('AI_CACHE_UNAVAILABLE');
        const doc = await client.collection(FIRESTORE_COLLECTIONS.ANALYSIS_CACHE).doc(key).get();
        const data = doc.data();
        return data && data.expiresAt?.toMillis() > Date.now() ? data.result : null;
      },
      set: async (key, value) => {
        const client = await firestoreService.getClient();
        if (!client) throw new Error('AI_CACHE_UNAVAILABLE');
        // JSON serialization drops optional undefined fields; this collection is server-only.
        await client.collection(FIRESTORE_COLLECTIONS.ANALYSIS_CACHE).doc(key).set({result: JSON.parse(JSON.stringify(value)),
          expiresAt: ttlTimestamp(RETENTION_DAYS.analysisCache), updatedAt: new Date()});
      },
    },
    existingEvents: existingEvents.map((e) => ({
      id: e.id,
      projectId: e.projectId,
      category: e.category,
      eventType: e.eventType,
      title: e.title,
      summary: e.summary,
      importance: e.importance,
      confidence: e.confidence,
      eventDate: e.eventDate,
      primarySourceUrl: e.primarySource?.url || '#',
      primarySourceTier: e.primarySource?.sourceTier || 'news',
      sources: e.sources || [],
      reasoningSummary: e.summary,
      materialImpactEvidence: e.materialImpactEvidence,
      sourceTier: e.sourceTier,
      provenance: e.provenance,
      telegramCandidate: e.importance >= 4 && !e.isHistorical,
      telegramCandidateReason: '기존 등록 이벤트',
      alreadyDispatched: e.alreadyDispatched,
      publishedAt: e.primarySource?.publishedAt,
      discoveredAt: e.firstSeenAt,
      isHistorical: e.isHistorical,
      telegramEligibleByRecency: e.telegramEligibleByRecency,
      createdAt: e.firstSeenAt || new Date().toISOString(),
      updatedAt: e.lastSeenAt || new Date().toISOString(),
    })),
    enableOfficialApi: process.env.ENABLE_OFFICIAL_API !== "false",
  });

  // 1. Persist discovered raw items into 'documents' collection
  let newDocsCount = 0;
  for (const rawItem of result.rawItems) {
    const matchedAudit = result.audit.itemAudits?.find((a) => a.sourceUrl === rawItem.sourceUrl && a.projectId === rawItem.projectId);
    const relatedness =
      matchedAudit?.deterministicGateResult === 'irrelevant' ? 'irrelevant' : (matchedAudit?.geminiRelatednessResult || 'uncertain');

    const saveRes = await firestoreService.saveDocument(
      {
        id: firestoreService.hashUrl(rawItem.sourceUrl),
        sourceType: rawItem.sourceType || 'news-rss',
        sourceTier: rawItem.sourceTier || 'news',
        title: rawItem.title || '무제 기사',
        url: rawItem.sourceUrl,
        publishedAt: rawItem.publishedAt || new Date().toISOString(),
        discoveredAt: rawItem.collectedAt || new Date().toISOString(),
        matchedProjectIds: [rawItem.projectId],
        relatedness,
        confidence: matchedAudit?.confidence ?? 0,
        sourceName: rawItem.sourceName || '언론보도',
        content: rawItem.content || '',
        attachmentUrls:rawItem.attachmentUrls||[],
        attachmentContentStatus:rawItem.attachmentContentStatus||'not_applicable',
        attachmentEvidence:rawItem.attachmentEvidence||[],
        rawFingerprint: rawItem.rawFingerprint || `${rawItem.projectId}_${rawItem.sourceUrl}`,
      },
      { production: isProduction }
    );
    if (saveRes.isNew) newDocsCount++;
  }

  // 2. Persist extracted events into 'events' collection (Strict Ordering Step 1)
  let newEventsCount = 0;
  for (const evt of result.events) {
    const primarySource = evt.sources?.[0] || {
      title: evt.title,
      url: evt.primarySourceUrl || '#',
      source: '언론보도',
      sourceTier: 'news' as const,
      publishedAt: evt.publishedAt || evt.eventDate,
      discoveredAt: evt.discoveredAt || new Date().toISOString(),
    };

    const saveRes = await firestoreService.saveEvent(
      {
        id: evt.id,
        projectId: evt.projectId,
        category: evt.category,
        materialImpactEvidence: evt.materialImpactEvidence,
        sourceTier: evt.sourceTier,
        provenance: evt.provenance,
        verificationStatus: evt.verificationStatus,
        eventType: evt.eventType,
        title: evt.title,
        summary: evt.summary,
        importance: evt.importance,
        confidence: evt.confidence,
        eventDate: evt.eventDate,
        isHistorical: evt.isHistorical || false,
        telegramEligibleByRecency: evt.telegramEligibleByRecency !== false,
        primarySource,
        sources: evt.sources,
        firstSeenAt: evt.createdAt || new Date().toISOString(),
        lastSeenAt: evt.updatedAt || new Date().toISOString(),
        alreadyDispatched: evt.alreadyDispatched || false,
      },
      { production: isProduction }
    );
    if (saveRes.isNew) newEventsCount++;
  }

  // 3. Strict Telegram Send Ordering:
  // Step 1: Event Firestore 저장 (완료됨)
  // Step 2: telegram delivery pending 기록 (원자적 중복 방지)
  // Step 3: Telegram API 호출
  // Step 4: 성공 시 sent 기록
  // Step 5: 실패 시 failed 기록
  let telegramSent = 0;
  let telegramFailed = 0;
  const dispatchedIds: string[] = [];

  if (enableTelegram && telegramNotifier.isConfigured()) {
    for (const evt of result.events) {
      // Check prior dispatch status
      const isDelivered = await firestoreService.isEventDelivered(evt.id, { production: isProduction });
      const qualCheck = telegramNotifier.qualifiesForDispatch(
        evt,
        isDelivered ? new Set([evt.id]) : new Set()
      );

      if (qualCheck.eligible) {
        const project = REDEVELOPMENT_SEED_PROJECTS.find((p) => p.id === evt.projectId);
        const formattedMsg = telegramNotifier.formatEventMessage(evt, project);
        const messageHash = telegramNotifier.calculateMessageHash(evt.id, formattedMsg);

        // Step 2: Atomic Delivery Reservation (status: pending)
        const reservation = await firestoreService.reserveTelegramDeliveryPending(
          evt.id,
          evt.projectId,
          messageHash,
          evt.importance,
          { production: isProduction }
        );

        if (!reservation.allowed) {
          console.warn(
            `[Telegram] Dispatch suppressed for ${evt.id}: ${reservation.reason}`
          );
          continue;
        }

        // Step 3: Telegram API 호출
        const sendRes = await telegramNotifier.dispatchEvent(evt, project);

        if (sendRes.outcomeUnknown) {
          // The message may already be delivered. Leave the reservation 'pending': it becomes
          // STALE_PENDING_NEEDS_REVIEW after the lock window and is never auto-resent.
          telegramFailed++;
          console.error(`[Telegram] Outcome unknown for event ${evt.id}: ${sendRes.error}. Held as pending for review (no automatic resend).`);
          continue;
        }

        // Step 4 / 5: Update status to 'sent' or 'failed'
        const updatedDelivery = await firestoreService.updateTelegramDeliveryResult(
          evt.id,
          {
            success: sendRes.success,
            sentAt: sendRes.sentAt,
            telegramMessageId: sendRes.messageId,
            error: sendRes.error,
            messageText: sendRes.messageText,
            messageHash: sendRes.messageHash,
          },
          { production: isProduction }
        );

        if (sendRes.success) {
          telegramSent++;
          dispatchedIds.push(evt.id);
        } else {
          telegramFailed++;
          console.error(
            `[Telegram] Dispatch failed for event ${evt.id}: ${sendRes.error}. Recorded as failed for safe retry.`
          );
        }
      }
    }
  }

  // 4. Save Collection Cycle Audit in 'collectionCycles' collection
  const finishedAt = new Date().toISOString();
  const cycleId = `cycle_${Date.now()}`;
  const cycleDoc: FirestoreCollectionCycleDoc = {
    id: cycleId,
    startedAt,
    finishedAt,
    sourcesChecked: result.audit.sourcesChecked,
    rssItemsDiscovered: result.audit.itemsDiscovered,
    officialApiStatus: result.audit.officialApiStatus || 'disabled',
    relevantItems: result.audit.relevantItems,
    eventsCreated: result.audit.eventsCreated,
    eventsMerged: result.audit.eventsMerged,
    telegramCandidates: result.audit.telegramCandidates,
    telegramSent,
    telegramFailed,
    // Stored as genuinely new in Firestore this cycle (eventsCreated counts events extracted
    // by the pipeline, including ones that already existed and were only refreshed).
    newEventsStored: newEventsCount,
    newDocumentsStored: newDocsCount,
    errors: result.audit.errors,
    explanationWhyNoAlert: result.audit.explanationWhyNoAlert,
    itemAudits: result.audit.itemAudits,
    sourceDetails: result.audit.sourceDetails,
  };

  Object.assign(cycleDoc, { aiUsage: result.aiUsage,queueStats:result.audit.queueStats,queueAttempted:result.audit.queueAttempted });
  console.log('[AI_USAGE]', JSON.stringify(result.aiUsage));
  // Firestore documents are capped at 1 MiB; oversized audits would fail the cycle after alerts went out.
  await firestoreService.saveCollectionCycle(capCollectionCycleDoc(cycleDoc), { production: isProduction });

  // Complete only after all event/document/cycle writes succeed; ready results survive a crash.
  await workQueue.ack(result.queueReadyIds||[]);

  // Phase 3B: Structured Operational Log for Cloud Logging / Cloud Run
  const operationalLog = {
    startedAt,
    finishedAt,
    queueStats:result.audit.queueStats,
    queueAttempted:result.audit.queueAttempted,
    rssItemsDiscovered: result.rawItems.length,
    relevantItems: result.audit.relevantItems,
    eventsCreated: result.audit.eventsCreated,
    eventsMerged: result.audit.eventsMerged,
    newEventsStored: newEventsCount,
    newDocumentsStored: newDocsCount,
    telegramCandidates: result.audit.telegramCandidates,
    telegramSent,
    telegramFailed,
    officialApiStatus: result.audit.officialApiStatus || 'disabled',
    errors: result.audit.errors,
  };

  console.log(`[PRODUCTION_POLL_AUDIT] ${JSON.stringify(operationalLog)}`);

  return {
    cycleId,
    ...operationalLog,
    sourcesChecked: result.audit.sourcesChecked,
    dispatchedIds,
    explanationWhyNoAlert: result.audit.explanationWhyNoAlert,
    audit: result.audit,
  };
}

/** Records the scheduled run outcome; never lets alerting failures affect the response. */
async function trackPollHealth(outcome: { ok: true } | { ok: false; reason: string }) {
  try {
    // Failure/recovery messages go to Telegram only when OPS_TELEGRAM_ALERTS=true (off by
    // default at the owner's request). Failures are still tracked and logged either way.
    const opsSender = process.env.OPS_TELEGRAM_ALERTS === 'true'
      ? telegramNotifier
      : { isConfigured: () => false, sendOpsAlert: async () => ({ success: false }) };
    const result = await recordPollOutcome(firestoreService, opsSender, outcome);
    if (!outcome.ok) console.warn('[PollHealth] Scheduled run failed:', result.state.lastFailureReason, `(consecutive ${result.state.consecutiveFailures})`);
    if (result.alertSent) console.warn('[PollHealth] Failure alert sent:', result.state.consecutiveFailures);
    if (result.recoverySent) console.log('[PollHealth] Recovery message sent');
  } catch (err: any) {
    console.warn('[PollHealth] tracking failed:', err?.name || 'unknown');
  }
}

/**
 * Cloud Scheduler Target Endpoint: /api/jobs/poll
 *
 * Requirements (Phase 3B Production Deployment Readiness):
 * - Target: POST /api/jobs/poll (Cloud Scheduler, once a day at 08:00 KST)
 * - Validates POLL_JOB_SECRET via Bearer token or x-cron-secret header only
 * - Preflight Checks:
 *   1. Firestore ready == true (Fail-Closed: 503, 0 Telegrams)
 *   2. Gemini API Key configured == true (Fail-Closed: 503 if missing)
 *   3. Telegram configured check (warning only if missing, skip alert without failing)
 *   4. Internal scheduler disabled check (warning if ENABLE_INTERNAL_SCHEDULER=true)
 *   5. Official Saeol API unavailable warning (news-rss proceeds normally)
 * - Strict Telegram Send Ordering (Event -> pending -> API -> sent/failed)
 * - Structured operational logging
 */
app.all('/api/jobs/poll', async (req, res) => {
  // Authentication is enforced by the global header-only API guard.
  const configuredSecret = process.env.POLL_JOB_SECRET || process.env.CRON_SECRET;
  // 2. Production Preflight Checks
  // A. Fail-Closed Check: Firestore available == true AND Firestore ready == true
  const fsHealth = await firestoreService.checkReady();
  if (!fsHealth.ready || !fsHealth.available) {
    console.error(
      `[Jobs/Poll Preflight Fail-Closed] Firestore unavailable (${fsHealth.error}). Fail-closed triggered: 0 Telegrams, 0 Events persisted.`
    );
    await trackPollHealth({ ok: false, reason: `Firestore 연결 불가 (${fsHealth.error || 'unknown'})` });
    return res.status(503).json({
      success: false,
      statusCode: 503,
      preflightPassed: false,
      error: 'Service Unavailable: Firestore is not ready or unavailable.',
      details: fsHealth.error,
      telegramSent: 0,
      eventsCreated: 0,
      productionPolicy: 'FAIL_CLOSED',
      memoryFallbackAllowed: false,
      message:
        '운영 /api/jobs/poll에서는 Firestore 정상 초기화(available && ready)가 필수이며, 미충족 시 메모리 fallback이 금지되고 즉시 HTTP 503 반환 및 Telegram 발송 0건으로 차단됩니다.',
    });
  }

  // B. Gemini API Key configured check
  const geminiConfigured = Boolean(
    process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== ''
  );
  if (!geminiConfigured) {
    console.error('[Jobs/Poll Preflight] OPENAI_API_KEY is not configured in production environment.');
    await trackPollHealth({ ok: false, reason: 'OPENAI_API_KEY 미설정' });
    return res.status(503).json({
      success: false,
      statusCode: 503,
      preflightPassed: false,
      error: 'Service Unavailable: OPENAI_API_KEY is not configured.',
      message: 'AI 뉴스 적합성 분류 및 이벤트 추출을 위해 OPENAI_API_KEY 설정이 필수입니다.',
      telegramSent: 0,
      eventsCreated: 0,
    });
  }

  const housing = await refreshHousingData();
  console.info('[housing] scheduled refresh', housing.map(result => result.status === 'fulfilled' ? result.value : 'failed'));

  // C. Internal scheduler disabled check
  const internalSchedulerEnabled = process.env.ENABLE_INTERNAL_SCHEDULER === 'true';
  if (internalSchedulerEnabled) {
    console.warn(
      '[Jobs/Poll Preflight Warning] ENABLE_INTERNAL_SCHEDULER=true is active. In production, external Cloud Scheduler (*/30 * * * *) is the recommended single driver.'
    );
  }

  // D. Telegram configured check
  const telegramConfigured = telegramNotifier.isConfigured();
  if (!telegramConfigured) {
    console.warn(
      '[Jobs/Poll Preflight Warning] Telegram is not configured (token or chat_id missing). Events will be persisted to Firestore, but alerts will be skipped.'
    );
  }

  // E. Official Saeol API status check (warning only)
  console.log(
    '[Jobs/Poll Preflight] Saeol requests follow key/ENABLE_OFFICIAL_API configuration; connection status is reported by collection audit.'
  );

  // 3. Execute Production Cycle with full strictness
  try {
    const pollResult = await executeProductionPollingCycle({
      source: 'scheduler',
      enableTelegram: true,
      production: true,
    });

    await trackPollHealth({ ok: true });
    return res.status(200).json({
      success: true,
      statusCode: 200,
      jobName: 'busan-redevelopment-poll-job',
      phase: 'Phase 3B - Production Deployment Readiness',
      schedulerContract: {
        method: 'POST',
        endpoint: '/api/jobs/poll',
        cronSchedule: '*/30 * * * *',
        auth: 'POLL_JOB_SECRET header (fail-closed)',
      },
      preflight: {
        firestoreReady: true,
        geminiConfigured: true,
        telegramConfigured,
        internalSchedulerDisabled: !internalSchedulerEnabled,
        officialApiStatus: process.env.ENABLE_OFFICIAL_API === 'false' || !process.env.DATA_GO_KR_API_KEY ? 'disabled' : 'configured / upstream not yet verified',
      },
      ...pollResult,
    });
  } catch (err: any) {
    if (err instanceof PollInProgressError) {
      return res.status(409).json({ success: false, statusCode: 409, error: 'POLL_ALREADY_RUNNING',
        message: '다른 수집 작업이 실행 중입니다. 이번 호출은 건너뜁니다.' });
    }
    const diagnostic = err instanceof FirestoreUnavailableError ? {
      operation: err.operation,
      collection: err.collection,
      documentId: err.documentId,
      firestoreErrorCode: err.firestoreErrorCode,
      firestoreErrorName: err.firestoreErrorName,
      safeMessage: err.safeMessage,
    } : undefined;

    await trackPollHealth({ ok: false, reason: `수집 실행 오류: ${err?.message || 'unknown'}` });
    console.error('[Jobs/Poll] Production poll error:', {
      name: err?.name,
      message: err?.message,
      ...(diagnostic || {}),
    });

    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: `Poll job failed: ${err.message}`,
      diagnostic,
      telegramSent: 0,
    });
  }
});

/**
 * Manual Pipeline Trigger API (Web UI button)
 */
app.all('/api/pipeline/run', async (req, res) => {
  try {
    const pollResult = await executeProductionPollingCycle({
      source: 'manual',
      // Authenticated operator verification can persist results without sending alerts.
      enableTelegram: req.query.notify !== 'false',
    });

    res.json({
      success: true,
      phase: 'Phase 3A',
      ...pollResult,
      message: '실제 뉴스 수집 및 Firestore 저장/Telegram 파이프라인 실행 완료',
    });
  } catch (err: any) {
    if (err instanceof PollInProgressError) {
      res.status(409).json({ success: false, error: 'POLL_ALREADY_RUNNING', message: '다른 수집 작업이 실행 중입니다.' });
      return;
    }
    res.status(500).json({ error: `Pipeline execution failed: ${err.message}` });
  }
});

// -------------------------------------------------------------
// Explicit API 404 & Error Handler (Guarantees no /api/* route falls through to HTML)
// -------------------------------------------------------------
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    error: 'API_NOT_FOUND',
    message: `API endpoint not found: ${req.method} ${req.originalUrl || req.url}`,
  });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.toLowerCase().startsWith('/api/')) {
    console.error(`[API Uncaught Error] ${req.method} ${req.path}:`, err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred',
    });
  }
  next(err);
});

// -------------------------------------------------------------
// Vite Middleware & Static Serving Setup
// -------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Vite is a build/dev tool only; loading it lazily keeps it out of the production
    // image's runtime dependencies and off the cold-start path.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      // Vite fingerprints everything under /assets (name-hash.js), so those files never change
      // and can be cached by the browser and the Firebase CDN for a year. index.html must
      // always be revalidated so a new deploy is picked up immediately.
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`) && /-[A-Za-z0-9_-]{8,}\.(js|css|woff2?)$/.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (process.env.NODE_ENV === 'production') {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.allSettled([apartmentBudget.refreshGwacheonFallback(), apartmentBudget.refreshTrades()]).then(results => {
          const trades = results[1];
          console.info('[housing] startup trade refresh', trades.status === 'fulfilled' ? trades.value : 'failed');
          if (results[0].status === 'rejected') console.warn('[housing] startup Gwacheon backfill failed');
        }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('HOUSING_STARTUP_TIMEOUT')), 25_000);
        }),
      ]);
    } catch (error) {
      console.warn('[housing] startup trade refresh delayed', error instanceof Error ? error.message : 'unknown');
    } finally {
      clearTimeout(timeout);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    if (process.env.IMPORT_FLOOR_PLANS_ON_START === 'true') {
      void refreshApartmentFloorPlans().then(result => console.info('[housing] startup floor plan import', result), error => console.warn('[housing] startup floor plan import failed', error instanceof Error ? error.message : 'unknown'));
    }
    console.log(`[Busan Redevelopment News Monitor] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
