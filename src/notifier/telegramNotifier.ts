import { evaluateDispatch } from './dispatchPolicy';
import { createHash } from 'crypto';
import { ExtractedEvent, RedevelopmentProject } from '../types/redevelopment';

export interface TelegramSendResult {
  success: boolean;
  messageId?: number | string;
  error?: string;
  sentAt: string;
  messageHash: string;
  chatId: string;
  messageText: string;
  isTest?: boolean;
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
    const projectName =
      project?.name ||
      (event.projectId === 'chokjin-3'
        ? '부산시민공원 촉진3구역'
        : event.projectId === 'udong-3'
        ? '해운대구 우동3구역'
        : event.projectId);

    const shortProject =
      event.projectId === 'chokjin-3'
        ? '촉진3구역'
        : event.projectId === 'udong-3'
        ? '우동3구역'
        : projectName;

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

    return `[${shortProject}] 중요도 ${stars}

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
${primaryUrl}`;
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
   * Send single test message (for /api/test/telegram)
   * Does NOT write to production events collection.
   */
  public async sendTestMessage(): Promise<TelegramSendResult> {
    const sentAt = new Date().toISOString();
    const testText = `[테스트 메시지] 부산 정비사업 실시간 알림 봇 연동 점검

현재 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST
대상 채널: 촉진3구역 / 우동3구역 실시간 모니터링 알림
상태: 봇 토큰 및 Chat ID 정상 연동 확인 완료

※ 본 메시지는 Telegram 연결 테스트 메시지이며, 운영 이벤트로 기록되지 않습니다.`;

    const messageHash = this.calculateMessageHash('test-event', testText);

    if (this.customSender) {
      const customRes = await this.customSender(testText, true);
      return {
        success: customRes.success,
        messageId: customRes.messageId,
        error: customRes.error,
        sentAt,
        messageHash,
        chatId: this.chatId || 'test_chat',
        messageText: testText,
        isTest: true,
      };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        isTest: true,
        error:
          'TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID 환경변수가 설정되지 않았습니다. AI Studio Settings 또는 .env에서 설정해주세요.',
        sentAt,
        messageHash,
        chatId: this.chatId || '',
        messageText: testText,
      };
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: testText,
          disable_web_page_preview: true,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json') && !contentType.includes('+json')) {
        return {
          success: false,
          isTest: true,
          error: `UPSTREAM_NON_JSON_RESPONSE: Telegram API returned non-JSON response [HTTP ${res.status}, Content-Type: ${contentType || 'unknown'}]`,
          sentAt,
          messageHash,
          chatId: this.chatId || '',
          messageText: testText,
        };
      }

      const data = await res.json();
      if (!res.ok || !data.ok) {
        return {
          success: false,
          isTest: true,
          error: `Telegram API 오류 [HTTP ${res.status}]: ${data.description || 'Unknown error'}`,
          sentAt,
          messageHash,
          chatId: this.chatId || '',
          messageText: testText,
        };
      }

      return {
        success: true,
        isTest: true,
        messageId: data.result?.message_id,
        sentAt,
        messageHash,
        chatId: this.chatId || '',
        messageText: testText,
      };
    } catch (err: any) {
      return {
        success: false,
        isTest: true,
        error: `Telegram 전송 네트워크 오류: ${err.message || String(err)}`,
        sentAt,
        messageHash,
        chatId: this.chatId || '',
        messageText: testText,
      };
    }
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

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: messageText,
          disable_web_page_preview: false,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json') && !contentType.includes('+json')) {
        return {
          success: false,
          error: `UPSTREAM_NON_JSON_RESPONSE: Telegram API returned non-JSON response [HTTP ${res.status}, Content-Type: ${contentType || 'unknown'}]`,
          sentAt,
          messageHash,
          chatId: this.chatId || '',
          messageText,
          isTest: false,
        };
      }

      const data = await res.json();
      if (!res.ok || !data.ok) {
        return {
          success: false,
          error: `Telegram API 오류 [HTTP ${res.status}]: ${data.description || 'Unknown error'}`,
          sentAt,
          messageHash,
          chatId: this.chatId || '',
          messageText,
          isTest: false,
        };
      }

      return {
        success: true,
        messageId: data.result?.message_id,
        sentAt,
        messageHash,
        chatId: this.chatId || '',
        messageText,
        isTest: false,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Telegram 전송 네트워크 오류: ${err.message || String(err)}`,
        sentAt,
        messageHash,
        chatId: this.chatId || '',
        messageText,
        isTest: false,
      };
    }
  }
}
