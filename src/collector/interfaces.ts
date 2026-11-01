/**
 * Busan Redevelopment News Monitor - Collector Interfaces
 * Phase 1: 수집기 아키텍처 및 인터페이스 설계
 */

import { RawCollectedItem, RedevelopmentProject, SourceTier } from '../types/redevelopment.ts';

/**
 * 수집 옵션
 */
export interface CollectorFetchOptions {
  /** 수집 기준 시작 시각 (증분 수집 시 직전 수집 시각 이후 데이터만 필터링) */
  sinceTimestamp?: string;
  /** 프로젝트당 최대 수집 항목 수 */
  limit?: number;
  /** 타임아웃 (ms) */
  timeoutMs?: number;
  /** 드라이런 모드 (실제 수집 시뮬레이션 및 쿼리 파라미터 검증) */
  isDryRun?: boolean;
}

/**
 * 수집기 실행 통계
 */
export interface CollectorExecutionStats {
  sourceName: string;
  sourceTier: SourceTier;
  projectId: string;
  itemsFetched: number;
  itemsAccepted: number;
  itemsDeduplicated: number;
  executionTimeMs: number;
  error?: string;
}

/**
 * 개별 데이터 소스별 수집 어댑터 인터페이스
 * - 공식 고시/공고 수집기 (부산시청, 부산진구청, 해운대구청 등)
 * - 뉴스 포털 / 언론사 RSS 수집기 (네이버 뉴스, 다음 뉴스, 구글 뉴스 RSS 등)
 */
export interface ICollectorAdapter {
  /** 어댑터 고유 식별자 (예: 'busan-official-gosi-adapter', 'naver-news-api-adapter') */
  readonly adapterId: string;
  /** 제공하는 소스 티어: 'official' (공식 행정자료) | 'news' (언론 보도) */
  readonly sourceTier: SourceTier;
  /** 소스 매체명 (예: '부산광역시 고시공고', '네이버 뉴스', '구글 뉴스') */
  readonly sourceName: string;

  /**
   * 해당 정비사업 구역에 대해 수집 쿼리를 구성하고 원본 데이터를 수집
   * @param project 대상 정비사업 (촉진3구역 또는 우동3구역)
   * @param options 수집 옵션 (시간 범위, limit 등)
   */
  fetchForProject(
    project: RedevelopmentProject,
    options?: CollectorFetchOptions
  ): Promise<RawCollectedItem[]>;

  /**
   * 어댑터 상태 검증 (연결성, API 키 유효성 등)
   */
  healthCheck?(): Promise<{ isHealthy: boolean; message?: string }>;
}

/**
 * 통합 수집 서비스 인터페이스
 */
export interface ICollectorService {
  /** 수집 어댑터 등록 */
  registerAdapter(adapter: ICollectorAdapter): void;

  /** 특정 정비사업 구역에 대해 모든 활성화된 어댑터를 실행하여 수집 */
  collectForProject(
    project: RedevelopmentProject,
    options?: CollectorFetchOptions
  ): Promise<{
    items: RawCollectedItem[];
    stats: CollectorExecutionStats[];
  }>;

  /** Registry의 모든 활성 모니터링 구역(촉진3, 우동3)에 대해 일괄 수집 실행 */
  collectAllProjects(options?: CollectorFetchOptions): Promise<{
    totalItems: RawCollectedItem[];
    projectItemMap: Record<string, RawCollectedItem[]>;
    stats: CollectorExecutionStats[];
  }>;
}

/**
 * 뉴스 검색 쿼리 빌더 인터페이스
 * 각 구역별 aliases와 locationKeywords를 조합하여 검색 쿼리를 생성
 */
export interface ICollectorQueryBuilder {
  buildQueries(project: RedevelopmentProject): {
    primaryQueries: string[]; // 예: ['"촉진3구역"', '"우동3구역"']
    extendedQueries: string[]; // 예: ['"촉진3" 재개발', '"우동3" 시공사']
    officialSearchTerms: string[]; // 행정 사이트 검색어
  };
}

/**
 * 표준 쿼리 빌더 구현체
 */
export class DefaultCollectorQueryBuilder implements ICollectorQueryBuilder {
  public buildQueries(project: RedevelopmentProject) {
    // 따옴표로 정확한 구역명 바인딩
    const primaryQueries = [
      `"${project.aliases[0]}"`,
      `"${project.aliases[1] || project.aliases[0]}"`,
    ];

    const extendedQueries = [
      `"${project.aliases[0]}" 재개발`,
      `"${project.aliases[0]}" 시공사`,
      `"${project.aliases[0]}" 공사비`,
      `"${project.aliases[0]}" 총회`,
    ];

    const officialSearchTerms = [
      project.aliases[0],
      project.name,
      ...project.locationKeywords.slice(0, 2),
    ];

    return {
      primaryQueries,
      extendedQueries,
      officialSearchTerms,
    };
  }
}
