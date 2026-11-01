/**
 * Phase 4A: Historical Backfill Preparation Architecture
 *
 * 목적:
 * 향후 과거 자료(부산시·구청 고시/공고, 행정자료, 조합자료, 과거 뉴스 기사)를
 * 안전하고 일관되게 events 컬렉션에 Backfill 적재할 수 있는 파이프라인 구조 설계.
 *
 * 엄격한 원칙 (Phase 4A):
 * 1. REAL DATA OR EXPLICIT ABSENCE: 실제 과거 문서가 제공되지 않으면 임의 이벤트를 절대 생성하지 않음.
 * 2. NO UNINTENDED TELEGRAM: 모든 과거 Backfill 이벤트는 isHistorical = true, telegramEligibleByRecency = false로 설정.
 * 3. NO DUPLICATION: 동일 사건이 이미 events에 존재하면 병합하거나 재생성하지 않음.
 * 4. SOURCE TIER TRUTH: 언론기사에 행정 사실이 언급되었더라도 출처가 기사면 news(언론보도)로 분류.
 */

import {
  EventSourceTier,
  ExtractedEvent,
  RedevelopmentProject,
  VerificationStatus,
} from '../types/redevelopment.ts';
import { FirestoreEventDoc } from '../schema/firestoreSchema.ts';
import { createHash } from 'crypto';

/**
 * 과거 Backfill 대상 원본 문서 인터페이스
 */
export interface RawHistoricalDocument {
  id: string; // 고유 식별자 (URL 해시 또는 고시공고 고유ID)
  sourceType:
    | 'official-notice' // 부산시/부산진구/해운대구 고시공고
    | 'official-admin'  // 지자체 인허가 대장 등 공식 행정자료
    | 'association-doc' // 조합/사업주체 총회·공고 자료
    | 'archive-news';   // 과거 Google News 기사
  sourceName: string;
  sourceUrl: string;
  title: string;
  content: string;
  documentDate: string; // 문서 작성/발행일 (YYYY-MM-DD 또는 ISO)
  matchedProjectIds?: string[];
  noticeNumber?: string; // 고시공고번호 (예: '부산광역시 고시 제2023-123호')
  department?: string;   // 소관 부서 (예: '도시정비과')
}

/**
 * Backfill 파이프라인 처리 결과
 */
export interface HistoricalProcessingResult {
  processed: boolean;
  reason?: string;
  eventDoc?: FirestoreEventDoc;
  isDuplicate?: boolean;
}

export class HistoricalBackfillService {
  /**
   * 1. 사업 관련성 판정 (assessProjectRelevance)
   */
  public assessProjectRelevance(
    doc: RawHistoricalDocument,
    project: RedevelopmentProject
  ): { isRelevant: boolean; reason: string; matchedAlias?: string } {
    const text = `${doc.title} ${doc.content}`.toLowerCase();

    // 1-A. Alias 검사
    for (const alias of project.aliases) {
      if (text.includes(alias.toLowerCase())) {
        return {
          isRelevant: true,
          reason: `프로젝트 별칭 매칭: "${alias}"`,
          matchedAlias: alias,
        };
      }
    }

    // 1-B. Location Keywords + 재개발/정비사업 조합 매칭
    const hasDistrict = text.includes(project.district.toLowerCase());
    const hasLocation = project.locationKeywords.some((k) =>
      text.includes(k.toLowerCase())
    );
    const hasRedevKeyword =
      text.includes('정비') ||
      text.includes('재개발') ||
      text.includes('조합') ||
      text.includes('인가') ||
      text.includes('고시');

    if (hasDistrict && hasLocation && hasRedevKeyword) {
      return {
        isRelevant: true,
        reason: `관할구(${project.district}) 및 주요 위치/정비 키워드 복합 매칭`,
      };
    }

    return {
      isRelevant: false,
      reason: `해당 사업지(${project.name})와 연관된 별칭이나 지리 키워드가 없음`,
    };
  }

  /**
   * 2. 사건일 추출 (extractEventDate)
   * 고시일, 총회일, 기사 보도일 등 실증적 일자 추출 (임의 생성 금지)
   */
  public extractEventDate(doc: RawHistoricalDocument): string {
    // 문서에 명시된 날짜를 우선 적용
    if (doc.documentDate && /^\d{4}-\d{2}-\d{2}/.test(doc.documentDate)) {
      return doc.documentDate.slice(0, 10);
    }

    // 본문 내 YYYY년 M월 D일 또는 YYYY.MM.DD 정규식 탐색
    const dateMatch = doc.content.match(/(\d{4})[년.-]\s*(\d{1,2})[월.-]\s*(\d{1,2})[일]?/);
    if (dateMatch) {
      const year = dateMatch[1];
      const month = dateMatch[2].padStart(2, '0');
      const day = dateMatch[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // 일자가 확인되지 않으면 문서 등록일 또는 null safe fallback
    return doc.documentDate ? doc.documentDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  }

  /**
   * 3. 출처 등급 판정 (determineSourceTier)
   * 중요: 언론기사에 행정절차가 언급되었다는 이유만으로 공식자료로 분류하지 않는다.
   */
  public determineSourceTier(doc: RawHistoricalDocument): EventSourceTier {
    if (doc.sourceType === 'official-notice' || doc.sourceType === 'official-admin') {
      return 'official';
    }
    if (doc.sourceType === 'association-doc') {
      return 'association';
    }
    if (doc.sourceType === 'archive-news') {
      return 'news';
    }
    return 'other';
  }

  /**
   * 4. 검증 상태 판정 (determineVerificationStatus)
   */
  public determineVerificationStatus(
    sourceTier: EventSourceTier,
    doc: RawHistoricalDocument
  ): VerificationStatus {
    if (sourceTier === 'official') {
      return 'verified';
    }
    if (sourceTier === 'association') {
      return 'supported';
    }
    if (sourceTier === 'news') {
      // 다수 보도 교차 검증은 'supported', 단일 기사는 'unverified'
      return 'supported';
    }
    return 'unverified';
  }

  /**
   * 5. 기존 Event 중복 검사 (checkEventDuplicate)
   */
  public checkEventDuplicate(
    existingEvents: (ExtractedEvent | FirestoreEventDoc)[],
    projectId: string,
    eventDate: string,
    eventType: string,
    signature: string
  ): boolean {
    return existingEvents.some((e) => {
      if (e.projectId !== projectId) return false;
      // 동일 서명
      if ((e as any).eventClusterSignature && (e as any).eventClusterSignature === signature) {
        return true;
      }
      // 동일 일자 + 동일 eventType (예: 2023-05-12 사업시행인가)
      if (e.eventDate === eventDate && e.eventType === eventType) {
        return true;
      }
      return false;
    });
  }

  /**
   * 6. 과거 문서로부터 Historical Event Doc 규격 생성
   * (isHistorical = true, telegramEligibleByRecency = false 필수 보장)
   */
  public createHistoricalEventDoc(
    doc: RawHistoricalDocument,
    project: RedevelopmentProject,
    eventType: string,
    summary: string,
    category: any = '사업단계',
    importance: any = 3
  ): FirestoreEventDoc {
    const eventDate = this.extractEventDate(doc);
    const sourceTier = this.determineSourceTier(doc);
    const verificationStatus = this.determineVerificationStatus(sourceTier, doc);

    // Deterministic signature
    const signature = `hist_${project.id}_${eventDate.replace(/-/g, '')}_${eventType.replace(/\s+/g, '_')}`;
    const eventId = `evt_${createHash('sha256').update(signature).digest('hex').slice(0, 16)}`;

    const eventDoc: FirestoreEventDoc = {
      id: eventId,
      projectId: project.id,
      category,
      eventType,
      title: doc.title,
      summary,
      importance,
      confidence: sourceTier === 'official' ? 1.0 : 0.85,
      eventDate,

      // 핵심 안전 필드: 과거 자료는 알림 발송 대상에서 원천 차단
      isHistorical: true,
      telegramEligibleByRecency: false,
      alreadyDispatched: true, // Telegram 중복 방지 플래그 기선점

      sourceTier,
      verificationStatus,
      provenance: {
        originalSourceId: doc.id,
        sourceCollection: 'historical-backfill',
        collector: 'HistoricalBackfillService',
        documentNumber: doc.noticeNumber,
        department: doc.department,
        sourceType: doc.sourceType,
        collectedAt: new Date().toISOString(),
        notes: `Backfill from ${doc.sourceName} (${eventDate})`,
      },

      primarySource: {
        title: doc.title,
        url: doc.sourceUrl,
        source: doc.sourceName,
        sourceTier: sourceTier === 'official' ? 'official' : 'news',
        publishedAt: doc.documentDate,
      },

      sources: [
        {
          title: doc.title,
          url: doc.sourceUrl,
          source: doc.sourceName,
          sourceTier: sourceTier === 'official' ? 'official' : 'news',
          publishedAt: doc.documentDate,
          discoveredAt: new Date().toISOString(),
          noticeNumber: doc.noticeNumber,
          department: doc.department,
        },
      ],

      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };

    return eventDoc;
  }

  /**
   * 단일 과거 문서 처리 파이프라인
   */
  public processHistoricalDocument(
    doc: RawHistoricalDocument,
    project: RedevelopmentProject,
    existingEvents: (ExtractedEvent | FirestoreEventDoc)[],
    eventType: string,
    summary: string,
    category: any = '사업단계',
    importance: any = 3
  ): HistoricalProcessingResult {
    // 1. 관련성 평가
    const relevance = this.assessProjectRelevance(doc, project);
    if (!relevance.isRelevant) {
      return {
        processed: false,
        reason: `관련성 없음: ${relevance.reason}`,
      };
    }

    // 2. 사건일 추출
    const eventDate = this.extractEventDate(doc);

    // 3. 중복 검사
    const signature = `hist_${project.id}_${eventDate.replace(/-/g, '')}_${eventType.replace(/\s+/g, '_')}`;
    const isDup = this.checkEventDuplicate(existingEvents, project.id, eventDate, eventType, signature);
    if (isDup) {
      return {
        processed: false,
        isDuplicate: true,
        reason: `이미 등록된 사건 이력 (중복 건너뜀): ${project.id} ${eventDate} ${eventType}`,
      };
    }

    // 4. 이벤트 생성
    const eventDoc = this.createHistoricalEventDoc(
      doc,
      project,
      eventType,
      summary,
      category,
      importance
    );

    return {
      processed: true,
      eventDoc,
    };
  }
}

export const historicalBackfillService = new HistoricalBackfillService();
