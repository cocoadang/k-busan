import { evaluateDispatch } from './dispatchPolicy';
import { createHash } from 'crypto';
import { ExtractedEvent, RedevelopmentProject } from '../types/redevelopment';
import { REDEVELOPMENT_SEED_PROJECTS } from '../registry/redevelopmentRegistry';

export interface TelegramSendResult {
  success: boolean;
  messageId?: number | string;
  error?: string;
  sentAt: string;
  messageHash: string;
  chatId: string;
  messageText: string;
  isTest?: boolean;
  /**
   * True when the request timed out or the connection dropped after it may have reached
   * Telegram. The message might already be delivered, so callers must not retry it automatically.
   */
  outcomeUnknown?: boolean;
}

/** Telegram sendMessage hard limit is 4096 chars; keep headroom for the ellipsis. */
export const TELEGRAM_MAX_MESSAGE_LENGTH = 4000;
export const TELEGRAM_REQUEST_TIMEOUT_MS = 10_000;
/** Longest Telegram-advised wait (seconds) we honour before a single retry. */
export const TELEGRAM_MAX_RETRY_AFTER_S = 30;

export function clampTelegramText(text: string): string {
  return text.length > TELEGRAM_MAX_MESSAGE_LENGTH ? text.slice(0, TELEGRAM_MAX_MESSAGE_LENGTH - 1) + '…' : text;
}

/**
 * Real Telegram Bot Notifier for Busan Redevelopment Alerts
 *
 * Requirements:
 * - Real API integration via https://api.telegram.org/bot<TOKEN>/sendMessage
 * - Strict dispatch criteria (importance >= 4, confidence >= 0.75, relevant, recency eligible)
 * - Exact message template matching user specifications
 * - Duplicate prevention via message hash & event ID
 * - Explicit failure logging on network/API errors (allows safe retry)
 */
export class TelegramNotifier {
  private botToken?: string;
  private chatId?: string;
  private minImportance: number;
  private customSender?: (text: string, isTest?: boolean) => Promise<{ success: boolean; messageId?: number | string; error?: string }>;

  constructor(options?: {
    botToken?: string;
    chatId?: string;
    minImportance?: number;
    customSender?: (text: string, isTest?: boolean) => Promise<{ success: boolean; messageId?: number | string; error?: string }>;
  }) {
    this.botToken = options?.botToken || process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = options?.chatId || process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHANNEL_ID;
    const parsedMin = parseInt(options?.minImportance?.toString() || process.env.TELEGRAM_MIN_IMPORTANCE || '4', 10);
    this.minImportance = isNaN(parsedMin) ? 4 : parsedMin;
    this.customSender = options?.customSender;
  }

  /**
   * Check whether Telegram secrets are configured
   */
  public isConfigured(): boolean {
    return Boolean(this.botToken && this.chatId && this.botToken.trim() !== '' && this.chatId.trim() !== '');
  }

  public getChatId(): string {
    return this.chatId || '';
  }

  /**
   * Render importance stars (1~5: ★★★★★)
   */
  public formatImportanceStars(importance: number): string {
    const clamped = Math.max(1, Math.min(5, Math.round(importance)));
    return '★'.repeat(clamped) + '☆'.repeat(5 - clamped);
  }

  /**
   * Format message according to exact specification:
   *
   * [촉진3구역] 중요도 ★★★★☆
   *
   * 제목
   *
   * 카테고리:
   * 사업단계
   *
   * AI 요약:
   * ...
   *
   * 출처:
   * 부산일보
   *
   * 발행:
   * 2026-09-xx
   *
   * 원문:
   * URL
   */
  public formatEventMessage(event: ExtractedEvent, project?: RedevelopmentProject): string {
    // Display names come from the registry (shortName → name); the id is the last resort.
    const entry = project || REDEVELOPMENT_SEED_PROJECTS.find((p) => p.id === event.projectId);
    const projectName = entry?.name || event.projectId;
    const shortProject = entry?.shortName || projectName;

    const stars = this.formatImportanceStars(event.importance);
    const categoryText = event.category ? `${event.category}` : '정비사업 현황';
    const primarySource = event.primarySourceUrl
      ? event.sources?.find((s) => s.url === event.primarySourceUrl) || event.sources?.[0]
      : event.sources?.[0];

    const sourceName = primarySource?.source || '부산 언론보도';
    const publishedDate =
      event.publishedAt?.slice(0, 10) ||
      primarySource?.publishedAt?.slice(0, 10) ||
      event.eventDate ||
      new Date().toISOString().slice(0, 10);
    const primaryUrl = event.primarySourceUrl || primarySource?.url || '#';

    return clampTelegramText(`[${shortProject}] 중요도 ${stars}

${event.title}

카테고리:
${categoryText}

AI 요약:
${event.summary}${event.materialImpactEvidence ? `\n\n변화: ${event.materialImpactEvidence.change}\n실질적 의미: ${event.materialImpactEvidence.practicalMeaning}\n상태: ${event.materialImpactEvidence.certainty === "confirmed" ? "확정" : "예정"}` : ""}

출처:
${sourceName}

발행:
${publishedDate}

원문:
${primaryUrl}`);
  }

  /**
   * Calculate deterministic message hash for duplicate prevention
   */
  public calculateMessageHash(eventId: string, messageText: string): string {
    return createHash('sha256').update(`${eventId}:${messageText.trim()}`).digest('hex');
  }

  /**
   * Check if event satisfies Telegram dispatch criteria:
   * - relatedness == relevant
   * - confidence >= 0.75
   * - importance >= 4
   * - telegramEligibleByRecency == true
   * - not already dispatched
   */
  public qualifiesForDispatch(
    event: ExtractedEvent,
    alreadyDeliveredEventIds: Set<string> = new Set()
  ): { eligible: boolean; reason?: string } {
    return evaluateDispatch({ ...event, alreadyDispatched: event.alreadyDispatched || alreadyDeliveredEventIds.has(event.id) }, this.minImportance);
  }

  /**
   * Dispatch real event alert message
   */
  public async dispatchEvent(
    event: ExtractedEvent,
    project?: RedevelopmentProject
  ): Promise<TelegramSendResult> {
    const sentAt = new Date().toISOString();
    const messageText = this.formatEventMessage(event, project);
    const messageHash = this.calculateMessageHash(event.id, messageText);

    if (this.customSender) {
      const customRes = await this.customSender(messageText, false);
      return {
        success: customRes.success,
        messageId: customRes.messageId,
        error: customRes.error,
        sentAt,
        messageHash,
        chatId: this.chatId || 'test_chat',
        messageText,
        isTest: false,
      };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID 환경변수가 설정되지 않았습니다.',
        sentAt,
        messageHash,
        chatId: this.chatId || '',
        messageText,
        isTest: false,
      };
    }

    const sent = await this.sendText(messageText, false);
    return { ...sent, sentAt, messageHash, chatId: this.chatId || '', messageText, isTest: false };
  }

  /**
   * Operational alert (collection failures / recovery). Not tied to an event, never stored
   * as a delivery; callers are responsible for de-duplicating how often it is sent.
   */
  public async sendOpsAlert(text: string): Promise<{ success: boolean; error?: string }> {
    const body = clampTelegramText(`[부산 정비사업 모니터 운영 알림]\n\n${text}`);
    if (this.customSender) {
      const res = await this.customSender(body, true);
      return { success: res.success, error: res.error };
    }
    if (!this.isConfigured()) return { success: false, error: 'TELEGRAM_NOT_CONFIGURED' };
    const res = await this.sendText(body, true);
    return { success: res.success, error: res.error };
  }

  /**
   * Single sendMessage call with a timeout. HTTP 429 means Telegram did NOT accept the message,
   * so it is safe to wait the advised retry_after (up to 30 s) and try exactly once more.
   */
  private async sendText(
    text: string,
    disablePreview: boolean
  ): Promise<{ success: boolean; messageId?: number | string; error?: string; outcomeUnknown?: boolean }> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: this.chatId, text, disable_web_page_preview: disablePreview }),
          signal: AbortSignal.timeout(TELEGRAM_REQUEST_TIMEOUT_MS),
        });
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json') && !contentType.includes('+json')) {
          return { success: false, error: `UPSTREAM_NON_JSON_RESPONSE: Telegram API returned non-JSON response [HTTP ${res.status}, Content-Type: ${contentType || 'unknown'}]` };
        }
        const data = await res.json();
        if (res.status === 429 && attempt === 0) {
          const retryAfter = Number(data?.parameters?.retry_after);
          if (Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= TELEGRAM_MAX_RETRY_AFTER_S) {
            await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
            continue;
          }
        }
        if (!res.ok || !data.ok) {
          return { success: false, error: `Telegram API 오류 [HTTP ${res.status}]: ${data.description || 'Unknown error'}` };
        }
        return { success: true, messageId: data.result?.message_id };
      } catch (err: any) {
        const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
        return {
          success: false,
          error: timedOut
            ? `TELEGRAM_TIMEOUT: ${TELEGRAM_REQUEST_TIMEOUT_MS}ms 내 응답 없음 (발송 여부 불명)`
            : `Telegram 전송 네트워크 오류: ${err.message || String(err)}`,
          // The request may have reached Telegram; callers must not resend automatically.
          outcomeUnknown: true,
        };
      }
    }
    return { success: false, error: 'Telegram API 오류 [HTTP 429]: 재시도 후에도 발송 제한' };
  }
}
