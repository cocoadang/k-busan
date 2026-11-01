import React, { useState } from 'react';
import { Database, FileCode, CheckCircle2, Shield, Key } from 'lucide-react';
import { FIRESTORE_COLLECTIONS, REQUIRED_FIRESTORE_INDEXES } from '../schema/firestoreSchema.ts';

export const FirestoreSchemaView: React.FC = () => {
  const [activeCollection, setActiveCollection] = useState<string>(FIRESTORE_COLLECTIONS.EVENTS);

  const collections = [
    {
      id: FIRESTORE_COLLECTIONS.EVENTS,
      name: 'events',
      desc: '동일 사건 복수 기사/고시를 1개 단위로 병합한 이벤트 (Telegram 발송 기준 단위)',
      pk: 'eventId (클러스터 해시 또는 고유 ID)',
      fields: [
        { name: 'id', type: 'string', desc: '이벤트 고유 해시 ID' },
        { name: 'projectId', type: 'string', desc: '"chokjin-3" | "udong-3"' },
        { name: 'category', type: 'string', desc: '13대 카테고리 중 대표 카테고리' },
        { name: 'eventType', type: 'string', desc: '세부 이벤트 명칭 (예: 시공사 입찰 공고)' },
        { name: 'title', type: 'string', desc: '대표 사건 제목' },
        { name: 'summary', type: 'string', desc: 'Gemini AI 생성 종합 요약' },
        { name: 'importance', type: 'number (1~5)', desc: '사건 중요도 (>= 4 시 Telegram 발송 후보)' },
        { name: 'confidence', type: 'number (0~1)', desc: 'AI 분석 신뢰도 (>= 0.75 시 발송)' },
        { name: 'eventDate', type: 'string (YYYY-MM-DD)', desc: '사건 발생일' },
        { name: 'isHistorical', type: 'boolean', desc: '72h 초과 과거 고시/기사 여부' },
        { name: 'telegramEligibleByRecency', type: 'boolean', desc: '최신성 기준 발송 적격 여부' },
        { name: 'alreadyDispatched', type: 'boolean', desc: 'Telegram 1회 발송 완료 여부 (중복 방지)' },
        { name: 'sources', type: 'Array<EventSourceRef>', desc: '연계된 원문 기사/고시 출처 목록' },
        { name: 'firstSeenAt', type: 'ISO-8601 string', desc: '최초 발견 시각' },
        { name: 'lastSeenAt', type: 'ISO-8601 string', desc: '최근 업데이트 시각' },
      ],
    },
    {
      id: FIRESTORE_COLLECTIONS.PROJECTS,
      name: 'projects',
      desc: '정비사업 Registry 마스터 (촉진3구역, 우동3구역 메타데이터)',
      pk: 'project.id ("chokjin-3", "udong-3")',
      fields: [
        { name: 'id', type: 'string', desc: '고유 식별자' },
        { name: 'name', type: 'string', desc: '정식 정비구역 명칭' },
        { name: 'aliases', type: 'string[]', desc: '검색 별칭 목록' },
        { name: 'locationKeywords', type: 'string[]', desc: '지리/위치 키워드' },
        { name: 'district', type: 'string', desc: '관할 자치구 (부산진구, 해운대구)' },
        { name: 'city', type: 'string', desc: '부산광역시' },
        { name: 'stage', type: 'string', desc: '사업 진행 단계' },
        { name: 'builder', type: 'string', desc: '시공사 브랜드' },
        { name: 'isActiveMonitoring', type: 'boolean', desc: '모니터링 활성 여부' },
      ],
    },
    {
      id: FIRESTORE_COLLECTIONS.DOCUMENTS,
      name: 'documents',
      desc: '수집된 원본 기사 및 행정고시 원문 저장소 (URL 해시 멱등성 보장)',
      pk: 'sha256(url)',
      fields: [
        { name: 'id', type: 'string', desc: 'URL SHA-256 해시 기반 고유 ID' },
        { name: 'sourceType', type: '"news-rss" | "official-api"', desc: '수집 소스 유형' },
        { name: 'sourceTier', type: '"official" | "news"', desc: '출처 등급' },
        { name: 'title', type: 'string', desc: '원문 제목' },
        { name: 'url', type: 'string', desc: '원문 URL' },
        { name: 'publishedAt', type: 'ISO-8601 string', desc: '발행 일시' },
        { name: 'discoveredAt', type: 'ISO-8601 string', desc: '수집 일시' },
        { name: 'matchedProjectIds', type: 'string[]', desc: '매칭된 정비사업 ID 목록' },
        { name: 'relatedness', type: '"relevant" | "irrelevant"', desc: '구역 실질 관련성 여부' },
        { name: 'confidence', type: 'number', desc: '판정 신뢰도' },
        { name: 'sourceName', type: 'string', desc: '매체명 (부산일보, 국제신문 등)' },
      ],
    },
    {
      id: FIRESTORE_COLLECTIONS.COLLECTION_CYCLES,
      name: 'collectionCycles',
      desc: '외부 Cloud Scheduler 호출 주기 및 "왜 알림이 없었는가" 감사 로그',
      pk: 'cycle_{timestamp}',
      fields: [
        { name: 'id', type: 'string', desc: '수집 주기 고유 ID' },
        { name: 'startedAt', type: 'ISO-8601 string', desc: '수집 시작 시각' },
        { name: 'finishedAt', type: 'ISO-8601 string', desc: '수집 완료 시각' },
        { name: 'officialApiStatus', type: '"disabled" | "unavailable" | "active"', desc: '공식 API 상태 (Phase 3A: disabled)' },
        { name: 'rssItemsDiscovered', type: 'number', desc: 'RSS 발견 건수' },
        { name: 'relevantItems', type: 'number', desc: '유효 관련 건수' },
        { name: 'eventsCreated', type: 'number', desc: '신규 이벤트 생성 수' },
        { name: 'eventsMerged', type: 'number', desc: '기존 이벤트 병합 수' },
        { name: 'telegramCandidates', type: 'number', desc: '발송 후보 건수' },
        { name: 'telegramSent', type: 'number', desc: '실제 발송 성공 수' },
        { name: 'explanationWhyNoAlert', type: 'string', desc: '사용자용 미발송 사유 설명' },
      ],
    },
    {
      id: FIRESTORE_COLLECTIONS.TELEGRAM_DELIVERIES,
      name: 'telegramDeliveries',
      desc: '중요도 >= 4 이벤트의 실제 Telegram 봇 발송 및 중복 차단 이력',
      pk: 'deliv_{eventId}_{timestamp}',
      fields: [
        { name: 'id', type: 'string', desc: '발송 이력 고유 ID' },
        { name: 'eventId', type: 'string', desc: '대상 이벤트 ID' },
        { name: 'projectId', type: 'string', desc: '대상 정비사업 ID' },
        { name: 'sentAt', type: 'ISO-8601 string', desc: '발송 일시' },
        { name: 'status', type: '"success" | "failed"', desc: '발송 결과' },
        { name: 'messageHash', type: 'string', desc: '메시지 본문 해시 (중복 차단)' },
        { name: 'chatId', type: 'string', desc: '수신 Telegram 채널 ID' },
        { name: 'telegramMessageId', type: 'number | string', desc: 'Telegram API 응답 Message ID' },
        { name: 'error', type: 'string', desc: '발송 실패 시 오류 메시지 (재시도 지원)' },
      ],
    },
  ];

  const currentCol = collections.find((c) => c.id === activeCollection) || collections[0];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            독립 전용 Firestore 데이터베이스 스키마 설계
          </h2>
          <p className="text-xs text-slate-500">
            타 프로젝트와 완전 격리된 전용 컬렉션 6종 및 복합 인덱스(Composite Indexes) 구조
          </p>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          <span>기존 Firestore DB 미사용 / 독립 인스턴스 전용</span>
        </span>
      </div>

      {/* 컬렉션 탭 */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2 mb-4">
        {collections.map((col) => (
          <button
            key={col.id}
            onClick={() => setActiveCollection(col.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeCollection === col.id
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {col.name}
          </button>
        ))}
      </div>

      {/* 선택된 컬렉션 스키마 상세 */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900 font-mono">
                {currentCol.name}
              </h3>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">{currentCol.desc}</p>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] bg-white px-2.5 py-1 rounded-md border border-slate-200 text-slate-700">
            <Key className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-semibold">PK (Doc ID):</span>
            <code className="text-blue-600 font-mono">{currentCol.pk}</code>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-slate-400 border-b border-slate-200">
                <th className="pb-2 font-semibold">필드명 (Field)</th>
                <th className="pb-2 font-semibold">타입 (Type)</th>
                <th className="pb-2 font-semibold">설명 (Description)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {currentCol.fields.map((f, i) => (
                <tr key={i} className="hover:bg-slate-100/50">
                  <td className="py-2 font-mono font-bold text-slate-800">{f.name}</td>
                  <td className="py-2 font-mono text-blue-600">{f.type}</td>
                  <td className="py-2 text-slate-600">{f.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 필수 복합 인덱스 (Composite Indexes) 안내 */}
      <div className="rounded-lg border border-slate-200 p-3 bg-white">
        <div className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
          <FileCode className="w-3.5 h-3.5 text-blue-600" />
          필수 복합 인덱스 설계 (Composite Indexes for Query Optimization)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
          {REQUIRED_FIRESTORE_INDEXES.map((idx, i) => (
            <div
              key={i}
              className="p-2 rounded bg-slate-50 border border-slate-100 flex items-center justify-between"
            >
              <div>
                <span className="font-mono font-semibold text-slate-700">
                  {idx.collectionGroup}
                </span>
                <span className="text-slate-400 ml-1">
                  ({idx.fields.map((f) => `${f.fieldPath}:${f.order}`).join(', ')})
                </span>
              </div>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
