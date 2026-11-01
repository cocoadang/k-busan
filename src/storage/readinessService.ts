import type { RequestHandler } from 'express';
import { FirestoreService } from './firestoreService';
import { OfficialNoticeCollector } from '../collector/officialCollector';
import { TelegramNotifier } from '../notifier/telegramNotifier';

export interface ProductionReadinessResult {
  service: string;
  phase: string;
  timestamp: string;
  readyForProduction: boolean;
  firestoreAvailable: boolean;
  firestoreReady: boolean;
  telegramConfigured: boolean;
  geminiConfigured: boolean;
  schedulerMode: 'cloud-scheduler' | 'internal-interval';
  officialApiStatus: string;
  officialApiLastCheck?: ReturnType<OfficialNoticeCollector['getLastCheck']>;
  checks: {
    firestore: {
      available: boolean;
      ready: boolean;
      databaseId: string;
      error: string | null;
    };
    telegram: {
      configured: boolean;
      minImportance: number;
      botTokenConfigured: boolean;
      chatIdConfigured: boolean;
    };
    gemini: {
      configured: boolean;
      model: string;
    };
    scheduler: {
      internalEnabled: boolean;
      mode: 'cloud-scheduler' | 'internal-interval';
      recommendedSchedule: string;
      endpoint: string;
      httpMethod: string;
    };
    auth: {
      pollJobSecretConfigured: boolean;
      authHeaderRequired: boolean;
    };
  };
  warnings: string[];
}

/**
 * Evaluates production deployment readiness.
 * Guarantees zero secret exposure: all tokens and passwords are only reported as booleans.
 */
export async function evaluateProductionReadiness(
  fsService: FirestoreService,
  notifier?: TelegramNotifier,
  officialCollector?: OfficialNoticeCollector
): Promise<ProductionReadinessResult> {
  const fsHealth = await fsService.checkReady();
  const telegram = notifier || new TelegramNotifier();
  const telegramConfigured = telegram.isConfigured();
  const geminiConfigured = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== ''
  );
  const internalSchedulerEnabled = process.env.ENABLE_INTERNAL_SCHEDULER === 'true';
  const schedulerMode = internalSchedulerEnabled ? 'internal-interval' : 'cloud-scheduler';
  const pollSecretConfigured = Boolean(process.env.POLL_JOB_SECRET || process.env.CRON_SECRET);
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const officialApiConfigured = Boolean(
    process.env.DATA_GO_KR_API_KEY && process.env.DATA_GO_KR_API_KEY.trim() !== ''
  );

  const warnings: string[] = [];
  const officialDisabled = process.env.ENABLE_OFFICIAL_API === 'false';
  const officialApiLastCheck = officialCollector?.getLastCheck();
  const officialApiStatus = officialDisabled ? 'disabled'
    : !officialApiConfigured ? 'unavailable'
    : officialApiLastCheck ? (officialApiLastCheck.success ? 'active' : 'failed')
    : 'configured / upstream not yet verified';
  if (officialDisabled) warnings.push('official-api: ENABLE_OFFICIAL_API=false로 비활성화됨.');
  else if (!officialApiConfigured) warnings.push('official-api: DATA_GO_KR_API_KEY가 설정되지 않음.');
  else if (officialApiLastCheck && !officialApiLastCheck.success) {
    warnings.push(`official-api: 최근 조회 실패 (Code: ${officialApiLastCheck.resultCode}, HTTP ${officialApiLastCheck.httpStatus}).`);
  }
  if (!pollSecretConfigured) {
    warnings.push('POLL_JOB_SECRET is not configured. /api/jobs/poll is blocked until a secret is configured.');
  }
  if (internalSchedulerEnabled) {
    warnings.push(
      'ENABLE_INTERNAL_SCHEDULER is set to true. For Cloud Run deployment, ENABLE_INTERNAL_SCHEDULER=false with Cloud Scheduler is recommended.'
    );
  }
  if (!telegramConfigured) {
    warnings.push('Telegram credentials (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID) are missing. Alerts will be skipped.');
  }

  const readyForProduction = fsHealth.ready && geminiConfigured && !internalSchedulerEnabled;

  return {
    service: 'Busan Redevelopment News Monitor',
    phase: 'Phase 3B - Production Deployment Readiness',
    timestamp: new Date().toISOString(),
    readyForProduction,
    firestoreAvailable: fsHealth.available,
    firestoreReady: fsHealth.ready,
    telegramConfigured,
    geminiConfigured,
    schedulerMode,
    officialApiStatus,
    officialApiLastCheck,
    checks: {
      firestore: {
        available: fsHealth.available,
        ready: fsHealth.ready,
        databaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
        error: fsHealth.error,
      },
      telegram: {
        configured: telegramConfigured,
        minImportance: Number(process.env.TELEGRAM_MIN_IMPORTANCE || 4),
        botTokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        chatIdConfigured: Boolean(process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHANNEL_ID),
      },
      gemini: {
        configured: geminiConfigured,
        model: geminiModel,
      },
      scheduler: {
        internalEnabled: internalSchedulerEnabled,
        mode: schedulerMode,
        recommendedSchedule: '*/30 * * * *',
        endpoint: '/api/jobs/poll',
        httpMethod: 'POST',
      },
      auth: {
        pollJobSecretConfigured: pollSecretConfigured,
        authHeaderRequired: pollSecretConfigured,
      },
    },
    warnings,
  };
}


/** Preview reads already-public production data; no cross-project credentials. */
export function createPreviewReadOnlyMiddleware(isPreview: boolean): RequestHandler {
  const allowed = new Set(['/storage/overview', '/status', '/readiness', '/health',
    '/registry', '/taxonomy', '/developments', '/plans', '/unit-types', '/site-plans', '/buildings']);
  return async (req, res, next) => {
    if (!isPreview) { next(); return; }
    res.setHeader('X-Preview-Mode', 'production-read-only');
    if (req.method !== 'GET' || !allowed.has(req.path)) {
      res.status(403).json({ success: false, error: 'PREVIEW_READ_ONLY',
        message: '미리보기는 운영 데이터 조회만 가능합니다. 수집·저장·발송은 차단됩니다.' });
      return;
    }
    try {
      // Fixed origin and allowlist; never forward cookies, secrets or auth headers.
      const target = new URL('/api' + req.path, 'https://k-busan.ai.studio');
      target.search = new URL(req.originalUrl, 'http://localhost').search;
      const upstream = await fetch(target, { signal: AbortSignal.timeout(15000),
        headers: { Accept: 'application/json' }, redirect: 'error' });
      if (!(upstream.headers.get('content-type') || '').includes('application/json')) {
        throw new Error('Non-JSON response');
      }
      const data = await upstream.json();
      res.setHeader('Cache-Control', 'no-store');
      res.status(upstream.status).json(data);
    } catch (error: any) {
      console.warn('[PreviewReadOnly] Production read failed:', error?.cause?.code || error?.name || 'UNKNOWN');
      res.status(502).json({ success: false, error: 'PREVIEW_UPSTREAM_UNAVAILABLE',
        message: '운영 데이터 조회에 실패했습니다. 잠시 후 다시 시도해주세요.' });
    }
  };
}
