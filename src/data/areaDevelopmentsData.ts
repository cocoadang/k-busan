/**
 * 주변 지역변화 및 개발계획 11건 (Phase 4C-2 Audit 확정본)
 * 
 * 감사 원칙:
 * 1. Phase 4C-2 Audit에서 확정된 11건만 포함 (황령산 봉수전망대, 부산항선 트램 제외).
 * 2. relevanceLevel:
 *    - direct: 사업지 인접 또는 교통/생활권 직접 영향 (6건)
 *    - regional: 같은 권역에 영향을 주지만 직접 영향은 제한적 (5건)
 * 3. impactDirection:
 *    - positive (긍정), negative (부정), mixed (복합), uncertain (불확실)
 *    - 부동산 가격 상승이나 수익률 언급 금지 (물리적 인프라·교통·환경 변화만 서술)
 * 4. documentUrlVerified:
 *    - true: 원문 보기 (공식 고시/문서 직결 링크 확인 시)
 *    - false: 출처 사이트 (대표 포털/도메인)
 */

import { FirestoreAreaDevelopmentDoc } from '../schema/firestoreSchema.ts';

export const AREA_DEVELOPMENTS_DATA: FirestoreAreaDevelopmentDoc[] = [
  // 1. 차세대 부산형 급행철도 (BuTX)
  {
    developmentId: 'dev-butx',
    title: '차세대 부산형 급행철도 (BuTX)',
    category: '철도·대중교통',
    affectedProjectIds: ['chokjin-3', 'udong-3'],
    relevanceLevel: 'direct',
    status: '계획',
    planStage: '민자적격성 통과',
    impactDirection: 'positive',
    impactReason: '가덕도신공항~명지~북항~부전~센텀~오시리아를 잇는 대심도 급행철도로, 부전역 및 센텀시티역 정차를 통해 동·서부산 및 공항 도심 접근성을 대폭 개선합니다.',
    announcementDate: '2025-10-01',
    expectedCompletionDate: null,
    sourceTier: 'official',
    sourceName: '부산광역시 철도과',
    sourceUrl: 'https://www.busan.go.kr',
    verificationStatus: 'verified',
    documentUrlVerified: false,
    lastVerifiedAt: '2026-09-13T00:00:00Z',
  },

  // 2. 부전역 복합환승센터 건립사업
  {
    developmentId: 'dev-bujeon-transfer-center',
    title: '부전역 복합환승센터 건립사업',
    category: '철도·대중교통',
    affectedProjectIds: ['chokjin-3'],
    relevanceLevel: 'direct',
    status: '계획',
    planStage: '기본구상·타당성조사 용역',
    impactDirection: 'positive',
    impactReason: '부전역 일대에 동해선·중앙선 KTX-이음 및 도시철도 1호선을 입체 연계하고 상업·업무 복합 인프라를 확충하여 대중교통 환승 편의를 획기적으로 개선합니다.',
    announcementDate: '2026-01-29',
    expectedCompletionDate: '2034-12-31',
    sourceTier: 'official',
    sourceName: '국토교통부 대광위 / 부산시',
    sourceUrl: 'https://www.busan.go.kr',
    verificationStatus: 'verified',
    documentUrlVerified: false,
    lastVerifiedAt: '2026-09-13T00:00:00Z',
  },

  // 3. 부전-마산 복선전철 건설사업
  {
    developmentId: 'dev-bujeon-masan-rail',
    title: '부전-마산 복선전철 건설사업',
    category: '철도·대중교통',
    affectedProjectIds: ['chokjin-3'],
    relevanceLevel: 'direct',
    status: '공사중',
    planStage: '복구공사 및 부분개통 추진',
    impactDirection: 'positive',
    impactReason: '부전역에서 김해를 거쳐 마산까지 51.1km를 잇는 간선철도로 창원·마산 광역 통근망이 직결되어 도심 교통 거점 기능을 높입니다.',
    announcementDate: '2026-02-20',
    expectedCompletionDate: '2028-12-31',
    sourceTier: 'official',
    sourceName: '국토교통부 철도국',
    sourceUrl: 'https://www.molit.go.kr',
    verificationStatus: 'verified',
    documentUrlVerified: false,
    lastVerifiedAt: '2026-09-13T00:00:00Z',
  },

  // 4. 만덕-센텀 도심고속화도로 (대심도)
  {
    developmentId: 'dev-manduk-centum-tunnel',
    title: '만덕-센텀 도심고속화도로 (대심도)',
    category: '도로·교통망',
    affectedProjectIds: ['udong-3'],
    relevanceLevel: 'regional',
    status: '완료',
    planStage: '준공 및 개통 (2026-02)',
    impactDirection: 'positive',
    impactReason: '북구 만덕과 해운대 센텀을 지하 40m로 연결하는 9.62km 왕복 4차로로 만덕~센텀 통행시간을 40분에서 10분대로 단축시켰습니다.',
    announcementDate: '2026-02-10',
    expectedCompletionDate: '2026-02-10',
    sourceTier: 'official',
    sourceName: '부산광역시 도로계획과',
    sourceUrl: 'https://www.busan.go.kr',
    verificationStatus: 'verified',
    documentUrlVerified: false,
    lastVerifiedAt: '2026-09-13T00:00:00Z',
  },

  // 5. 사상-해운대 고속도로 (대심도)
  {
    developmentId: 'dev-sasang-haeundae-highway',
    title: '사상-해운대 고속도로 (대심도)',
    category: '도로·교통망',
    affectedProjectIds: ['chokjin-3', 'udong-3'],
    relevanceLevel: 'direct',
    status: '계획',
    planStage: '시의회 동의·실시협약 준비',
    impactDirection: 'positive',
    impactReason: '남해고속도로와 동해고속도로를 잇는 22.8km 대심도 도로망으로, 개설 시 도심 노후 동서고가로 철거·녹지화(촉진3) 및 동서 광역 연결(우동3)을 실현합니다.',
    announcementDate: '2026-09-11',
    expectedCompletionDate: null,
    sourceTier: 'official',
    sourceName: '부산광역시의회 / 국토교통부',
    sourceUrl: 'https://council.busan.go.kr',
    verificationStatus: 'verified',
    documentUrlVerified: false,
    lastVerifiedAt: '2026-09-13T00:00:00Z',
  },

  // 6. 광안대교 접속도로 (벡스코~센텀)
  {
    developmentId: 'dev-gwangan-bridge-connection',
    title: '광안대교 접속도로 (벡스코~센텀)',
    category: '도로·교통망',
    affectedProjectIds: ['udong-3'],
    relevanceLevel: 'regional',
    status: '완료',
    planStage: '준공 및 개통 (2025-12)',
    impactDirection: 'positive',
    impactReason: '광안대교 벡스코 요금소에서 센텀시티 지하차도를 연결하는 램프교량과 언더패스로 수영강변대로 및 센텀 일대 병목현상을 완화했습니다.',
    announcementDate: '2025-12-22',
    expectedCompletionDate: '2025-12-22',
    sourceTier: 'official',
    sourceName: '부산광역시 건설본부',
    sourceUrl: 'https://www.busan.go.kr',
    verificationStatus: 'verified',
    documentUrlVerified: false,
    lastVerifiedAt: '2026-09-13T00:00:00Z',
  },

  // 7. 범천동 철도차량정비단 이전사업
  {
    developmentId: 'dev-beomcheon-depot-relocation',
    title: '범천동 철도차량정비단 이전사업',
    category: '주변 대규모 개발',
    affectedProjectIds: ['chokjin-3'],
    relevanceLevel: 'regional',
    status: '보류',
    planStage: '민간공모 유찰·사업재검토',
    impactDirection: 'uncertain',
    impactReason: '서면 도심을 단절해 온 대규모 철도차량정비단을 부산신항으로 이전하고 복합단지를 조성하는 계획이나, 민간공모 유찰로 추진 방식 재검토 중입니다.',
    announcementDate: '2025-06-15',
    expectedCompletionDate: null,
    sourceTier: 'official',
    sourceName: '한국철도공사 / 부산광역시',
    sourceUrl: 'https://www.busan.go.kr',
    verificationStatus: 'verified',
    documentUrlVerified: false,
    lastVerifiedAt: '2026-09-13T00:00:00Z',
  },

  // 8. 센텀2지구 도시첨단산업단지
  {
    developmentId: 'dev-centum2-industry-complex',
    title: '센텀2지구 도시첨단산업단지',
    category: '주변 대규모 개발',
    affectedProjectIds: ['udong-3'],
    relevanceLevel: 'regional',
    status: '공사중',
    planStage: '1단계 착공 (2026-02)',
    impactDirection: 'positive',
    impactReason: '해운대 반여·석대동 약 191만㎡ 부지에 AI·첨단소재 등 지식산업 인프라를 구축하는 도심융합특구 산업단지 1단계 공사가 진행 중입니다.',
    announcementDate: '2026-02-25',
    expectedCompletionDate: '2032-12-31',
    sourceTier: 'official',
    sourceName: '부산도시공사',
    sourceUrl: 'https://www.bmc.busan.kr',
    verificationStatus: 'verified',
    documentUrlVerified: false,
    lastVerifiedAt: '2026-09-13T00:00:00Z',
  },

  // 9. 옛 메가마트 부지 주거복합개발
  {
    developmentId: 'dev-megamart-site-development',
    title: '옛 메가마트 부지 주거복합개발',
    category: '주변 대규모 개발',
    affectedProjectIds: ['samik-beach'],
    relevanceLevel: 'direct',
    status: '공사중',
    planStage: '토목 및 지반정화 공사',
    impactDirection: 'mixed',
    impactReason: '남천동 메가마트 부지에 최고 40층 845세대 공동주택이 신축 중으로, 도보 대형마트 상실 및 공사 간섭과 하이엔드 주거타운 형성 효과가 혼재합니다.',
    announcementDate: '2024-08-05',
    expectedCompletionDate: '2028-09-30',
    sourceTier: 'news',
    sourceName: '대우건설 / 지역언론',
    sourceUrl: 'https://www.kookje.co.kr',
    verificationStatus: 'supported',
    documentUrlVerified: false,
    lastVerifiedAt: '2026-09-13T00:00:00Z',
  },

  // 10. 옛 해운대역사 시민광장·공원화
  {
    developmentId: 'dev-old-haeundae-station-park',
    title: '옛 해운대역사 시민광장·공원화',
    category: '공원·수변·녹지',
    affectedProjectIds: ['udong-3'],
    relevanceLevel: 'direct',
    status: '공사중',
    planStage: '리모델링 및 광장 조성',
    impactDirection: 'positive',
    impactReason: '우동3구역 도보 3분 거리의 옛 해운대역사 및 폐선 부지를 시민광장과 녹지축으로 탈바꿈하여 해리단길과 구남로를 잇는 보행 환경을 개선합니다.',
    announcementDate: '2023-05-18',
    expectedCompletionDate: null,
    sourceTier: 'official',
    sourceName: '해운대구청',
    sourceUrl: 'https://www.haeundae.go.kr',
    verificationStatus: 'verified',
    documentUrlVerified: false,
    lastVerifiedAt: '2026-09-13T00:00:00Z',
  },

  // 11. 부산콘서트홀 (구 부산국제아트센터)
  {
    developmentId: 'dev-busan-concert-hall',
    title: '부산콘서트홀 (구 부산국제아트센터)',
    category: '교육·생활SOC',
    affectedProjectIds: ['chokjin-3'],
    relevanceLevel: 'direct',
    status: '완료',
    planStage: '준공 및 정식 개관 (2025-06)',
    impactDirection: 'positive',
    impactReason: '촉진3구역 바로 앞 부산시민공원 내에 2,000석 규모 클래식 전용 콘서트홀과 400석 챔버홀을 갖춘 문화예술 시설이 준공되어 개관 운영 중입니다.',
    announcementDate: '2025-06-01',
    expectedCompletionDate: '2025-06-01',
    sourceTier: 'official',
    sourceName: '부산광역시 문화체육국',
    sourceUrl: 'https://www.busan.go.kr',
    verificationStatus: 'verified',
    documentUrlVerified: false,
    lastVerifiedAt: '2026-09-13T00:00:00Z',
  },
];
