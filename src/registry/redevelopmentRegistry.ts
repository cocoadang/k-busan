/**
 * Busan Redevelopment Project Registry
 * 모니터링 대상 구역 Seed 정의. 새 구역은 이 배열에 항목을 추가하는 것만으로
 * 수집(뉴스·조합 게시판·고시)·분석·알림 설정이 반영된다 (README '새 정비구역 추가 방법').
 */

import { RedevelopmentProject } from '../types/redevelopment.ts';
import { SEED_PROJECT_STAGES } from './seedProjectStages.ts';

export const REDEVELOPMENT_SEED_PROJECTS: readonly RedevelopmentProject[] = [
  {
    id: 'chokjin-3',
    name: '부산시민공원주변(촉진3구역) 재정비촉진구역',
    aliases: [
      '촉진3구역',
      '촉진3',
      '시민공원 촉진3구역',
      '부산시민공원 촉진3구역',
      '부산시민공원 촉진3',
      '부산 촉진3',
      '범전동 촉진3구역',
      '촉진3구역 재개발',
      '촉진3 재정비촉진',
      '아크로 라로체',
      '아크로라로체',
    ],
    locationKeywords: [
      '부산진구',
      '범전동',
      '부산시민공원',
      '시민공원',
      '부전역',
      '촉진지구',
      '재정비촉진지구',
      '부산시민공원 재정비촉진지구',
      '동평로',
      '시민공원로',
    ],
    district: '부산진구',
    city: '부산광역시',
    type: '재개발',
    stage: SEED_PROJECT_STAGES['chokjin-3'].currentStage,
    nextStage: SEED_PROJECT_STAGES['chokjin-3'].nextStage,
    builder: 'DL이앤씨 (하이엔드 브랜드: 아크로 라로체)',
    estimatedUnits: 3554,
    description:
      '부산시민공원 남측에 위치한 부산 최대 랜드마크 재정비촉진지구. 최고 60층, 3,500여 세대 규모의 대단지 하이엔드 주거 타운 조성 추진 중.',
    officialSourceUrls: [
      'https://www.busan.go.kr/gosi', // 부산광역시 고시공고
      'https://www.busanjin.go.kr/board/list.busanjin?boardId=BBS_0000021', // 부산진구청 고시/공고
    ],
    shortName: '촉진3구역',
    associationBoard: {
      listUrl: 'https://dynamice.busan.go.kr/view.do?no=287',
      boardId: 'BBSMSTR_000000000080',
      areaId: 'BARA_0000000000151',
      detailMenuNo: '329',
      titlePattern: '촉진\\s*3',
      sourceName: '촉진3구역 조합 입찰공고 (부산 정비사업 통합홈페이지)',
      auditSourceName: '촉진3 조합 입찰 게시판',
      matchedKeywords: ['촉진3구역'],
    },
    isActiveMonitoring: true,
    createdAt: '2026-09-11T00:00:00.000Z',
    updatedAt: '2026-09-11T00:00:00.000Z',
  },
  {
    id: 'udong-3',
    name: '해운대구 우동3구역 주택재개발정비사업',
    aliases: [
      '우동3구역',
      '우동3',
      '해운대 우동3구역',
      '해운대 우동3',
      '우동3 재개발',
      '해운대 우동3 재개발',
      '디에이치 아센테르',
      '디에이치아센테르',
    ],
    locationKeywords: [
      '해운대구',
      '우동',
      '해운대역',
      '해운대',
      '동백역',
      '구남로',
      '해운대로',
      '우동1로',
      '해리단길',
      '해운대관광특구',
    ],
    district: '해운대구',
    city: '부산광역시',
    type: '재개발',
    stage: SEED_PROJECT_STAGES['udong-3'].currentStage,
    nextStage: SEED_PROJECT_STAGES['udong-3'].nextStage,
    builder: '현대건설 (하이엔드 브랜드: 디에이치 아센테르)',
    estimatedUnits: 2503,
    description:
      '해운대역 북측 전통 원도심 주거지역을 재개발하는 해운대 최대어 정비사업. 해운대 최초 현대건설 하이엔드 브랜드 "디에이치" 적용 구역.',
    officialSourceUrls: [
      'https://www.busan.go.kr/gosi', // 부산광역시 고시공고
      'https://www.haeundae.go.kr/board/list.do?boardId=BBS_0000021', // 해운대구청 고시/공고
    ],
    shortName: '우동3구역',
    isActiveMonitoring: true,
    createdAt: '2026-09-11T00:00:00.000Z',
    updatedAt: '2026-09-11T00:00:00.000Z',
  },
  {
    id: 'samik-beach',
    name: '삼익비치타운(남천2구역)',
    aliases: [
      '삼익비치',
      '삼익비치타운',
      '남천2구역',
      '남천2구역(삼익비치)',
      '남천2구역 삼익비치',
      '남천삼익비치',
      '그랑자이 더 비치',
      '그랑자이더비치',
    ],
    locationKeywords: [
      '수영구',
      '남천동',
      '광안리',
      '광안대교',
      '남천역',
      '광안해변로',
      '황령산',
    ],
    district: '부산광역시 수영구 남천동',
    city: '부산광역시',
    type: '재건축',
    stage: SEED_PROJECT_STAGES['samik-beach'].currentStage,
    nextStage: SEED_PROJECT_STAGES['samik-beach'].nextStage,
    builder: 'GS건설',
    estimatedUnits: 3060,
    description:
      '부산 수영구 남천동에 위치한 기존 3,060세대 규모의 대규모 재건축 정비구역. 2016년 GS건설이 시공사로 선정되었으며, 사업시행계획 변경인가를 거쳐 정비계획 변경 추진 중.',
    generalSaleStatus: '확인 필요',
    officialSourceUrls: [
      'https://www.busan.go.kr/gosi', // 부산광역시 고시공고
      'https://www.suyeong.go.kr', // 수영구청 고시공고
    ],
    shortName: '삼익비치',
    isActiveMonitoring: true, // 2026-11: 뉴스·새올 고시 실시간 수집 대상 포함
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
  },
  {
    "id": "gwacheon-5",
    "name": "과천주공 5단지 재건축",
    "aliases": [
      "과천주공5단지",
      "과천 주공5단지",
      "과천 주공 5단지",
      "과천5단지",
      "과천 5단지"
    ],
    "locationKeywords": [
      "과천시"
    ],
    "district": "과천시",
    "city": "과천시",
    "type": "재건축",
    "stage": SEED_PROJECT_STAGES['gwacheon-5'].currentStage,
    "nextStage": SEED_PROJECT_STAGES['gwacheon-5'].nextStage,
    "generalSaleStatus": "입주자모집공고 확인 필요",
    "description": "뉴스·과천시 고시 모니터링 활성. 조합 게시판은 공개 범위 및 연결 검증 중.",
    "officialSourceUrls": [
      "https://www.gccity.go.kr/portal/saeol/gosi/list.do?mId=0301040000",
      "https://www.gg.go.kr/onnuri/mbiz/home/GHMT_0000000000053/main.do"
    ],
    "isActiveMonitoring": true,
    "createdAt": "2026-10-14T05:04:00.000Z",
    "updatedAt": "2026-10-14T05:04:00.000Z"
  },
  {
    "id": "gwacheon-89",
    "name": "과천주공 8·9단지 재건축",
    "aliases": [
      "과천주공8·9단지",
      "과천주공 8·9단지",
      "과천주공 8,9단지",
      "과천주공 8ㆍ9단지",
      "과천 8 9단지",
      "과천주공 8단지",
      "과천주공 9단지",
      "과천 8ㆍ9단지",
      "과천 8·9 단지",
      "과천주공8,9단지",
      "과천주공8ㆍ9단지",
      "과천주공89단지",
      "과천 8·9단지",
      "과천 8,9단지",
      "과천 8단지",
      "과천 9단지",
      "과천주공8단지",
      "과천주공9단지"
    ],
    "locationKeywords": [
      "과천시"
    ],
    "district": "과천시",
    "city": "과천시",
    "type": "재건축",
    "stage": SEED_PROJECT_STAGES['gwacheon-89'].currentStage,
    "nextStage": SEED_PROJECT_STAGES['gwacheon-89'].nextStage,
    "generalSaleStatus": "입주자모집공고 확인 필요",
    "description": "뉴스·과천시 고시 모니터링 활성. 조합 게시판은 공개 범위 및 연결 검증 중.",
    "officialSourceUrls": [
      "https://www.gccity.go.kr/portal/saeol/gosi/list.do?mId=0301040000",
      "https://www.gg.go.kr/onnuri/mbiz/home/BARA_0000000000624/main.do"
    ],
    // 구두점이 많은 별칭 OR 검색은 Google RSS 가 넓게 해석하므로 정밀 검색어를 개별 질의
    "newsSearchTerms": ['과천 "8단지" 재건축', '과천 "9단지" 재건축', '과천 "8 9단지" 재건축'],
    "isActiveMonitoring": true,
    "createdAt": "2026-10-14T05:04:00.000Z",
    "updatedAt": "2026-10-14T05:04:00.000Z"
  },
  {
    "id": "gwacheon-10",
    "name": "과천주공 10단지 재건축",
    "aliases": [
      "과천주공10단지",
      "과천 주공10단지",
      "과천 주공 10단지",
      "과천10단지",
      "과천 10단지"
    ],
    "locationKeywords": [
      "과천시"
    ],
    "district": "과천시",
    "city": "과천시",
    "type": "재건축",
    "stage": SEED_PROJECT_STAGES['gwacheon-10'].currentStage,
    "nextStage": SEED_PROJECT_STAGES['gwacheon-10'].nextStage,
    "generalSaleStatus": "입주자모집공고 확인 필요",
    "description": "뉴스·과천시 고시 모니터링 활성. 조합 게시판은 공개 범위 및 연결 검증 중.",
    "officialSourceUrls": [
      "https://www.gccity.go.kr/portal/saeol/gosi/list.do?mId=0301040000",
      "https://m.gc10.kr/"
    ],
    "relatedReportRules": [
      {
        // 같은 날 과천역 연결통로 타당성 용역 입찰 보도는 묶되, 선정·계약 등 결과 보도는 분리
        "key": "station-passage-feasibility-procurement",
        "allOf": ["과천역|지하철", "연결통로", "타당성", "업체|용역"],
        "noneOf": "낙찰|선정완료|계약체결|개통|착공|취소|재공고|유찰|선정했다|선정됐다"
      }
    ],
    "isActiveMonitoring": true,
    "createdAt": "2026-10-14T05:04:00.000Z",
    "updatedAt": "2026-10-14T05:04:00.000Z"
  },
];

/**
 * Registry 관리 서비스
 */
export class RedevelopmentRegistry {
  private projects: Map<string, RedevelopmentProject>;

  constructor(initialSeed: readonly RedevelopmentProject[] = REDEVELOPMENT_SEED_PROJECTS) {
    this.projects = new Map();
    initialSeed.forEach((p) => this.projects.set(p.id, { ...p }));
  }

  /**
   * 모니터링 활성화된 전체 프로젝트 반환 (초기 2개)
   */
  public getAllActiveProjects(): RedevelopmentProject[] {
    return Array.from(this.projects.values()).filter((p) => p.isActiveMonitoring);
  }

  /**
   * ID로 프로젝트 조회
   */
  public getProjectById(id: string): RedevelopmentProject | undefined {
    return this.projects.get(id);
  }

  /**
   * 텍스트(기사 제목/본문) 내에서 프로젝트 별칭 및 위치 키워드를 분석하여 일치하는 프로젝트 검색
   */
  public matchProjects(text: string): Array<{ project: RedevelopmentProject; matchedKeywords: string[]; score: number }> {
    const results: Array<{ project: RedevelopmentProject; matchedKeywords: string[]; score: number }> = [];
    const normalized = text.replace(/\s+/g, ' ');

    for (const project of this.getAllActiveProjects()) {
      const matchedAliases = project.aliases.filter((alias) => normalized.includes(alias));
      const matchedLocations = project.locationKeywords.filter((kw) => normalized.includes(kw));

      // 별칭 매칭 시 강한 가중치(10점), 위치키워드 매칭 시 보조 가중치(2점)
      const score = matchedAliases.length * 10 + matchedLocations.length * 2;

      if (matchedAliases.length > 0 || score >= 6) {
        const matchedKeywords = [...matchedAliases, ...matchedLocations];
        results.push({
          project,
          matchedKeywords: Array.from(new Set(matchedKeywords)),
          score,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }
}

export const defaultRegistry = new RedevelopmentRegistry();
