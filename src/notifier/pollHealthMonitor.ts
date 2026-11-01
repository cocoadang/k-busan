/**
 * Tracks consecutive failures of the scheduled collection run and sends one Telegram
 * operations alert when the threshold is reached, plus one recovery message when a run
 * succeeds again. State lives in Firestore (opsState/pollHealth) so it survives Cloud Run
 * scale-to-zero between 30-minute runs; when Firestore itself is down the in-memory copy
 * is used and alerts are rate-limited per instance.
 */

export interface PollHealthState extends Record<string, unknown> {
  consecutiveFailures: number;
  lastFailureAt?: string;
  lastFailureReason?: string;
  alertSentAt?: string | null;
  lastSuccessAt?: string;
}

export interface PollHealthStore {
  getOpsState<T extends Record<string, unknown>>(key: string): Promise<T | null>;
  setOpsState(key: string, data: Record<string, unknown>): Promise<void>;
}

export interface OpsAlertSender {
  isConfigured(): boolean;
  sendOpsAlert(text: string): Promise<{ success: boolean; error?: string }>;
}

export const POLL_FAILURE_ALERT_THRESHOLD = 2;
/** While still failing, repeat the alert at most this often. */
export const POLL_FAILURE_REALERT_MS = 6 * 60 * 60 * 1000;
const KEY = 'pollHealth';

const kst = (iso: string) => new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

/** Strips anything that looks like a credential and keeps the reason short. */
export function summarizeFailureReason(reason: string): string {
  return reason
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot***')
    .replace(/(key|token|secret)=([^&\s]+)/gi, '$1=***')
    .slice(0, 300);
}

export async function recordPollOutcome(
  store: PollHealthStore,
  sender: OpsAlertSender,
  outcome: { ok: true } | { ok: false; reason: string },
  now: () => Date = () => new Date(),
): Promise<{ alertSent: boolean; recoverySent: boolean; state: PollHealthState }> {
  const prev: PollHealthState = (await store.getOpsState<PollHealthState>(KEY)) || { consecutiveFailures: 0 };
  const nowIso = now().toISOString();

  if (outcome.ok) {
    const wasAlerted = Boolean(prev.alertSentAt);
    let recoverySent = false;
    if (wasAlerted && sender.isConfigured()) {
      const res = await sender.sendOpsAlert(
        `✅ 수집이 복구됐습니다.\n연속 실패 ${prev.consecutiveFailures}회 후 ${kst(nowIso)}에 정상 완료.`);
      recoverySent = res.success;
    }
    const state: PollHealthState = { consecutiveFailures: 0, alertSentAt: null, lastSuccessAt: nowIso };
    // Avoid a Firestore write on every healthy run when nothing changed.
    if (prev.consecutiveFailures !== 0 || prev.alertSentAt || !prev.lastSuccessAt ||
        now().getTime() - new Date(prev.lastSuccessAt).getTime() > 24 * 60 * 60 * 1000) {
      await store.setOpsState(KEY, state);
    }
    return { alertSent: false, recoverySent, state };
  }

  const reason = summarizeFailureReason((outcome as { reason: string }).reason);
  const failures = (prev.consecutiveFailures || 0) + 1;
  const lastAlert = prev.alertSentAt ? new Date(prev.alertSentAt).getTime() : 0;
  const shouldAlert = failures >= POLL_FAILURE_ALERT_THRESHOLD &&
    (!lastAlert || now().getTime() - lastAlert >= POLL_FAILURE_REALERT_MS);

  let alertSent = false;
  if (shouldAlert && sender.isConfigured()) {
    const res = await sender.sendOpsAlert(
      `⚠️ 정기 수집이 ${failures}회 연속 실패했습니다.\n` +
      `마지막 실패: ${kst(nowIso)}\n원인: ${reason}\n` +
      (prev.lastSuccessAt ? `마지막 정상 수집: ${kst(prev.lastSuccessAt)}` : '정상 수집 기록 없음'));
    alertSent = res.success;
  }
  const state: PollHealthState = {
    ...prev,
    consecutiveFailures: failures,
    lastFailureAt: nowIso,
    lastFailureReason: reason,
    alertSentAt: alertSent ? nowIso : prev.alertSentAt ?? null,
  };
  await store.setOpsState(KEY, state);
  return { alertSent, recoverySent: false, state };
}
