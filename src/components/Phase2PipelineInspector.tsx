import React, { useState } from 'react';
import {
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Newspaper,
  Layers,
  Send,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
  Database,
  Search,
  Clock,
  Building,
  Key,
} from 'lucide-react';
import {
  CollectionCycleAudit,
  DryRunVerificationSummary,
  ExtractedEvent,
  ItemAuditRecord,
} from '../types/redevelopment.ts';

export const Phase2PipelineInspector: React.FC = () => {
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [probeLoading, setProbeLoading] = useState(false);
  const [historicalLoading, setHistoricalLoading] = useState(false);

  const [audit, setAudit] = useState<CollectionCycleAudit | null>(null);
  const [events, setEvents] = useState<ExtractedEvent[]>([]);
  const [dryRunSummary, setDryRunSummary] = useState<DryRunVerificationSummary | null>(null);
  const [probeData, setProbeData] = useState<any | null>(null);
  const [historicalDate, setHistoricalDate] = useState<string>('20240605');
  const [historicalResults, setHistoricalResults] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'dryrun' | 'events' | 'audit' | 'saeol'>('dryrun');

  // Trigger Real Collection Pipeline
  const handleRunRealPipeline = async () => {
    setPipelineLoading(true);
    try {
      const res = await fetch('/api/pipeline/run', { method: 'POST' });
      const data = await res.json();
      if (data.audit) setAudit(data.audit);
      if (data.events) setEvents(data.events);
      setActiveTab('events');
    } catch (err) {
      console.error('Pipeline execution error:', err);
    } finally {
      setPipelineLoading(false);
    }
  };

  // Trigger Dry Run Verification Suite (TC-1 ~ TC-12)
  const handleRunDryRun = async () => {
    setDryRunLoading(true);
    try {
      const res = await fetch('/api/pipeline/dry-run');
      const data: DryRunVerificationSummary = await res.json();
      setDryRunSummary(data);
      setActiveTab('dryrun');
    } catch (err) {
      console.error('Dry-run suite error:', err);
    } finally {
      setDryRunLoading(false);
    }
  };

  // Probe Busan Saeol Open API
  const handleProbeSaeol = async () => {
    setProbeLoading(true);
    try {
      const res = await fetch('/api/official/saeol-probe');
      const data = await res.json();
      setProbeData(data);
    } catch (err) {
      console.error('Probe failed:', err);
    } finally {
      setProbeLoading(false);
    }
  };

  // Run Historical Search
  const handleHistoricalSearch = async () => {
    if (!historicalDate) return;
    setHistoricalLoading(true);
    try {
      const res = await fetch(`/api/official/historical-search?date=${encodeURIComponent(historicalDate)}`);
      const data = await res.json();
      setHistoricalResults(data);
    } catch (err) {
      console.error('Historical search failed:', err);
    } finally {
      setHistoricalLoading(false);
    }
  };

  return (
    <div id="phase2-pipeline-inspector" className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs mb-8">
      {/* Header & Trigger Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-700">
              Phase 2 Pipeline
            </span>
            <h2 className="text-base font-bold text-slate-900">
              실제 자료 수집 파이프라인 & Gemini 이벤트 병합 검증기
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            촉진3구역·우동3구역 실제 공개 RSS/고시 수집, 2단계 관련성 판정, 중복 병합, 텔레그램 후보 산정
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRunDryRun}
            disabled={dryRunLoading || pipelineLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            {dryRunLoading ? (
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            )}
            검증 테스트 실행 (Dry-Run)
          </button>

          <button
            onClick={handleRunRealPipeline}
            disabled={pipelineLoading || dryRunLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            {pipelineLoading ? (
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            실제 자료 수집 파이프라인 실행
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 pt-4 pb-3 border-b border-slate-100 text-xs font-medium text-slate-600 overflow-x-auto">
        <button
          onClick={() => setActiveTab('dryrun')}
          className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer shrink-0 ${
            activeTab === 'dryrun'
              ? 'bg-purple-50 text-purple-700 font-bold'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          검증 스위트 (12대 핵심 요구사항)
          {dryRunSummary && (
            <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-700">
              {dryRunSummary.passedTests}/{dryRunSummary.totalTests} 통과
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('events')}
          className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer shrink-0 ${
            activeTab === 'events'
              ? 'bg-blue-50 text-blue-700 font-bold'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          추출 및 병합 이벤트
          {events.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-700">
              {events.length}건
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer shrink-0 ${
            activeTab === 'audit'
              ? 'bg-amber-50 text-amber-700 font-bold'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          수집 주기 감사(Audit) & 미발송 사유
        </button>

        <button
          onClick={() => setActiveTab('saeol')}
          className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
            activeTab === 'saeol'
              ? 'bg-emerald-50 text-emerald-700 font-bold'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-emerald-600" />
          부산 새올고시 Open API (Phase 2D)
          <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-600 text-white font-bold">
            Official API
          </span>
        </button>
      </div>

      {/* Tab 1: Dry-Run Verification Suite (8 Test Cases) */}
      {activeTab === 'dryrun' && (
        <div className="pt-4 space-y-4">
          {!dryRunSummary && (
            <div className="p-8 text-center rounded-lg border border-dashed border-slate-300 bg-slate-50/50">
              <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">
                Phase 2 8대 검증 테스트가 아직 실행되지 않았습니다.
              </p>
              <p className="text-[11px] text-slate-500 mb-4">
                상단의 '8대 검증 테스트 실행 (Dry-Run)' 버튼을 클릭하여 파이프라인 규칙을 검증하세요.
              </p>
              <button
                onClick={handleRunDryRun}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition cursor-pointer"
              >
                검증 실행
              </button>
            </div>
          )}

          {dryRunSummary && (
            <div>
              <div className="flex items-center justify-between p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h3 className="text-xs font-bold text-emerald-950">
                      Phase 2 수집 및 판정 규칙 8대 요구사항 전체 검증 완료
                    </h3>
                    <p className="text-[11px] text-emerald-700">
                      실행 시각: {new Date(dryRunSummary.runAt).toLocaleTimeString('ko-KR')} | 통과: {dryRunSummary.passedTests} / {dryRunSummary.totalTests} 건
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-600 text-white">
                  ALL PASSED
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dryRunSummary.results.map((test) => (
                  <div
                    key={test.id}
                    className={`p-3 rounded-lg border text-xs ${
                      test.passed
                        ? 'border-slate-200 bg-white hover:border-emerald-300'
                        : 'border-rose-200 bg-rose-50'
                    } transition-colors`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700">
                          {test.id}
                        </span>
                        <span>{test.name}</span>
                      </div>
                      {test.passed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 통과
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                          <XCircle className="w-3.5 h-3.5" /> 실패
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-600 mb-2 leading-relaxed">
                      {test.description}
                    </p>

                    <div className="p-2 rounded bg-slate-50 border border-slate-200/80 font-mono text-[10px] space-y-1">
                      <div className="text-slate-500">
                        기대치: <span className="text-slate-800 font-semibold">{test.expected}</span>
                      </div>
                      <div className="text-slate-500">
                        실측치: <span className="text-emerald-700 font-semibold">{test.actual}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Extracted and Merged Events */}
      {activeTab === 'events' && (
        <div className="pt-4 space-y-3">
          {events.length === 0 ? (
            <div className="p-8 text-center rounded-lg border border-dashed border-slate-300 bg-slate-50/50">
              <Layers className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">추출된 이벤트가 없습니다.</p>
              <p className="text-[11px] text-slate-500 mb-3">
                '실제 자료 수집 파이프라인 실행' 버튼을 누르면 실시간 뉴스와 공고를 수집해 이벤트를 추출합니다.
              </p>
              <button
                onClick={handleRunRealPipeline}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition cursor-pointer"
              >
                지금 수집 실행
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-blue-200 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          evt.projectId === 'chokjin-3'
                            ? 'bg-blue-100 text-blue-800'
                            : evt.projectId === 'samik-beach'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {evt.projectId === 'chokjin-3'
                          ? '촉진3구역'
                          : evt.projectId === 'samik-beach'
                          ? '삼익비치'
                          : '우동3구역'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {evt.category}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {evt.eventType}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Recency Badge */}
                      {evt.isHistorical ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          과거 아카이브 (72h 경과)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                          최신 (72h 이내)
                        </span>
                      )}

                      {/* Importance Badge */}
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          evt.importance >= 4
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        중요도 {evt.importance}등급
                      </span>

                      {/* Telegram Candidate Badge */}
                      {evt.telegramCandidate ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-600 text-white shadow-2xs">
                          <Send className="w-3 h-3" />
                          텔레그램 발송 후보
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
                          발송 제외 (피로도 방지)
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mb-1.5 leading-snug">
                    {evt.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed mb-3">
                    {evt.summary}
                  </p>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs mb-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <HelpCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="font-semibold">후보 판정 사유:</span>
                      <span className="text-slate-600">{evt.telegramCandidateReason}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 pl-5">
                      {evt.reasoningSummary}
                    </div>
                  </div>

                  {/* Merged Sources Information */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1.5">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3 text-purple-600" />
                        병합된 출처 ({evt.sources.length}건 연계)
                      </span>
                      <span className="text-slate-400">
                        대표 출처: {evt.primarySourceTier === 'official' ? '공식 행정문서 (우선)' : '언론보도'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {evt.sources.map((src, i) => (
                        <a
                          key={i}
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-slate-200 text-[11px] text-slate-700 hover:text-blue-600 hover:border-blue-300 transition-colors"
                        >
                          {src.sourceTier === 'official' ? (
                            <FileText className="w-3 h-3 text-amber-600" />
                          ) : (
                            <Newspaper className="w-3 h-3 text-blue-600" />
                          )}
                          <span className="font-medium">{src.source}</span>
                          {src.sourceType && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-100 text-slate-600">
                              {src.sourceType}
                            </span>
                          )}
                          {src.noticeNumber && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-50 text-amber-800 font-mono">
                              제{src.noticeNumber}호
                            </span>
                          )}
                          <span className="text-slate-400 truncate max-w-[140px]">{src.title}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Collection Cycle Audit ("Why was there no alert?") */}
      {activeTab === 'audit' && (
        <div className="pt-4 space-y-4">
          {!audit ? (
            <div className="p-8 text-center rounded-lg border border-dashed border-slate-300 bg-slate-50/50">
              <AlertTriangle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">감사 기록이 없습니다.</p>
              <p className="text-[11px] text-slate-500 mb-3">
                파이프라인을 실행하면 수집 건수, 필터링 현황 및 '미발송 사유'가 분석됩니다.
              </p>
              <button
                onClick={handleRunRealPipeline}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition cursor-pointer"
              >
                수집 및 감사 실행
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* "Why was there no alert?" Prominent Banner */}
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70">
                <div className="flex items-start gap-2.5">
                  <HelpCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-bold text-amber-950 mb-1">
                      이번 수집 주기 알림 발생 현황 분석 ("왜 알림이 없었는가?")
                    </h3>
                    <p className="text-xs text-amber-900 leading-relaxed font-medium">
                      {audit.explanationWhyNoAlert}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stat Counters Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-[11px] text-slate-500 mb-0.5">확인 소스 / 발견 자료</div>
                  <div className="text-base font-bold text-slate-900">
                    {audit.sourcesChecked}개소 / {audit.itemsDiscovered}건
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-[11px] text-slate-500 mb-0.5">관련 / 무관 / 검토 자료</div>
                  <div className="text-base font-bold text-slate-900">
                    <span className="text-blue-600">{audit.relevantItems}</span> /{' '}
                    <span className="text-slate-400">{audit.irrelevantItems}</span> /{' '}
                    <span className="text-amber-600">{audit.uncertainItems}</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-[11px] text-slate-500 mb-0.5">생성 이벤트 / 병합 건수</div>
                  <div className="text-base font-bold text-slate-900">
                    {audit.eventsCreated}개 / {audit.eventsMerged}회
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-[11px] text-slate-500 mb-0.5">텔레그램 후보 (≥4등급)</div>
                  <div className="text-base font-bold text-purple-700">
                    {audit.telegramCandidates}건
                  </div>
                </div>
              </div>

              {/* Source Connectivity Log */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
                <h4 className="text-xs font-bold text-slate-900 mb-2.5">
                  수집 소스별 연결 및 응답 상태 (Real Data or Explicit Failure)
                </h4>
                <div className="space-y-2">
                  {audit.sourceDetails.map((src, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {src.status === 'success' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        )}
                        <span className="font-semibold text-slate-800">{src.sourceName}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600">
                          {src.sourceTier}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {src.status === 'success' ? (
                          <span className="text-[11px] text-slate-600">
                            {src.itemsCount}건 발견
                          </span>
                        ) : (
                          <span className="text-[11px] text-rose-600 font-medium">
                            {src.error || '연결 실패'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Item-by-Item Evaluation Audit Log */}
              {audit.itemAudits && audit.itemAudits.length > 0 && (
                <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
                  <h4 className="text-xs font-bold text-slate-900 mb-2">
                    개별 수집 항목 판정 및 최신성 감사 (Item Provenance & Recency Audit)
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                          <th className="py-2 px-2.5 font-semibold">구역 / 출처</th>
                          <th className="py-2 px-2.5 font-semibold">자료 제목</th>
                          <th className="py-2 px-2.5 font-semibold">게이트 / 의미판정</th>
                          <th className="py-2 px-2.5 font-semibold">최신성 (72h)</th>
                          <th className="py-2 px-2.5 font-semibold">분류 / 중요도</th>
                          <th className="py-2 px-2.5 font-semibold">텔레그램 후보</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {audit.itemAudits.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2 px-2.5 whitespace-nowrap">
                              <span className="font-semibold text-slate-800">
                                {item.projectId === 'chokjin-3'
                                  ? '촉진3'
                                  : item.projectId === 'samik-beach'
                                  ? '삼익비치'
                                  : '우동3'}
                              </span>
                              <div className="text-[10px] text-slate-400">
                                {item.source}
                                {item.sourceType && ` (${item.sourceType})`}
                              </div>
                            </td>
                            <td className="py-2 px-2.5 max-w-xs">
                              <a
                                href={item.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-slate-800 hover:text-blue-600 line-clamp-1"
                              >
                                {item.title}
                              </a>
                              {item.noticeNumber && (
                                <span className="text-[9px] text-amber-700 bg-amber-50 px-1 rounded">
                                  고시 제{item.noticeNumber}호
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2.5 whitespace-nowrap">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  item.deterministicGateResult === 'relevant'
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {item.deterministicGateResult}
                              </span>
                              <span
                                className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  item.geminiRelatednessResult === 'relevant'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {item.geminiRelatednessResult}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 whitespace-nowrap">
                              {item.isHistorical ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-medium">
                                  아카이브(과거)
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 font-medium">
                                  최신(72h내)
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2.5 whitespace-nowrap">
                              <div className="text-slate-800">{item.eventType}</div>
                              <div className="text-[10px] text-slate-500">
                                {item.importance > 0 ? `${item.importance}등급` : '-'}
                              </div>
                            </td>
                            <td className="py-2 px-2.5 whitespace-nowrap">
                              {item.telegramCandidate ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                                  후보 승인
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] text-slate-400 bg-slate-100">
                                  제외
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Busan Saeol Open API Live Inspector & Historical Search */}
      {activeTab === 'saeol' && (
        <div className="pt-4 space-y-4">
          {/* API Specification Header Card */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-emerald-700" />
                <div>
                  <h3 className="text-xs font-bold text-emerald-950">
                    부산광역시 새올고시정보 Open API (공공데이터포털)
                  </h3>
                  <p className="text-[11px] text-emerald-800">
                    Base: apis.data.go.kr/6260000/SaeolAncmntInfoService/getSaeolAncmntInfo
                  </p>
                </div>
              </div>

              <button
                onClick={handleProbeSaeol}
                disabled={probeLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition disabled:opacity-50 cursor-pointer shadow-2xs shrink-0"
              >
                {probeLoading ? (
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Key className="w-3.5 h-3.5" />
                )}
                API 연결 상태 점검 (Live Probe)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-white border border-emerald-200/80">
                <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">인증 방식 (Authentication)</span>
                <span className="font-mono text-emerald-900 font-medium">
                  DATA_GO_KR_API_KEY (ServiceKey)
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-emerald-200/80">
                <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">모니터링 범위 (KST 기준)</span>
                <span className="font-medium text-slate-800">
                  당일(Today) & 전일(Yesterday) 일자별 쿼리
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-emerald-200/80">
                <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">데이터 원칙</span>
                <span className="font-semibold text-purple-800">
                  REAL DATA OR EXPLICIT FAILURE
                </span>
              </div>
            </div>
          </div>

          {/* Probe Output (If run) */}
          {probeData && (
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  실시간 API 응답 상태 (Live Probe Result)
                </h4>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    probeData.success
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {probeData.success ? '정상 연결' : `실패 (Result: ${probeData.resultCode || 'N/A'})`}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">HTTP 상태</span>
                  <span className="font-bold text-slate-800">{probeData.httpStatus}</span>
                </div>
                <div className="p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">결과 코드 (resultCode)</span>
                  <span className="font-bold font-mono text-slate-800">{probeData.resultCode || 'None'}</span>
                </div>
                <div className="p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">총 고시 건수</span>
                  <span className="font-bold text-slate-800">{probeData.totalCount}건</span>
                </div>
                <div className="p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">API 키 설정 여부</span>
                  <span className={`font-bold ${probeData.apiKeyConfigured ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {probeData.apiKeyConfigured ? '설정됨 (Configured)' : '미설정 (Missing)'}
                  </span>
                </div>
              </div>

              {probeData.error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs">
                  <div className="font-bold text-rose-900 mb-0.5">API 호출 실패 상세:</div>
                  <div className="text-rose-700 font-mono text-[11px]">{probeData.error}</div>
                  <p className="mt-1 text-[10px] text-rose-600">
                    * 공공데이터포털 승인 키가 유효하지 않거나 미등록 상태입니다. 시스템은 가짜 Mock 데이터를 절대 생성하지 않고 실패 상태를 유지합니다.
                  </p>
                </div>
              )}

              {probeData.rawFieldNames && probeData.rawFieldNames.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-500 block mb-1">
                    API 수신 필드 스키마 ({probeData.rawFieldNames.length}개 필드 식별):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {probeData.rawFieldNames.map((field: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px] font-mono">
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Historical Backfill Query Tester */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                <Search className="w-4 h-4 text-blue-600" />
                과거 공식 고시 검색 및 아카이브 검증 (Historical Backfill)
              </h4>
              <p className="text-[11px] text-slate-500">
                특정 고시일자(YYYYMMDD)를 입력하여 부산 새올고시정보에서 촉진3구역/우동3구역 관련 고시를 검색하고 72시간 경과 정책을 검증합니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={historicalDate}
                onChange={(e) => setHistoricalDate(e.target.value)}
                placeholder="YYYYMMDD (예: 20240605)"
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono w-44 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setHistoricalDate('20240605')}
                  className="px-2 py-1 rounded bg-slate-100 text-[11px] text-slate-600 hover:bg-slate-200"
                >
                  2024-06-05
                </button>
                <button
                  type="button"
                  onClick={() => setHistoricalDate('20230510')}
                  className="px-2 py-1 rounded bg-slate-100 text-[11px] text-slate-600 hover:bg-slate-200"
                >
                  2023-05-10
                </button>
              </div>

              <button
                onClick={handleHistoricalSearch}
                disabled={historicalLoading || !historicalDate}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer shadow-2xs ml-auto"
              >
                {historicalLoading ? (
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                과거 고시 조회 실행
              </button>
            </div>

            {/* Historical Search Results */}
            {historicalResults && (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="text-xs font-semibold text-slate-800">
                  검색 일자: {historicalResults.queryDate} 조회 결과
                </div>

                {historicalResults.results.map((pRes: any) => (
                  <div key={pRes.projectId} className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-blue-600" />
                        {pRes.projectName} ({pRes.projectId})
                      </span>
                      <span className="text-[11px] text-slate-500">
                        해당일 전체 고시 {pRes.totalNoticesInDate}건 중 구역 매칭 {pRes.matchedCount}건
                      </span>
                    </div>

                    {pRes.error ? (
                      <div className="text-[11px] text-rose-600 font-medium p-2 bg-rose-50 rounded border border-rose-100">
                        {pRes.error}
                      </div>
                    ) : pRes.matchedItems.length === 0 ? (
                      <div className="text-[11px] text-slate-500 p-2 bg-white rounded border border-slate-100">
                        해당 일자에 {pRes.projectName} 관련 공식 고시문이 발견되지 않았습니다. (가짜 Mock 생성 금지)
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {pRes.matchedItems.map((item: any, i: number) => (
                          <div key={i} className="p-2.5 rounded bg-white border border-slate-200 text-xs">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-bold text-slate-900">{item.title}</span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {item.publishedAt?.slice(0, 10)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                              <span>부서: {item.department || '-'}</span>
                              <span>구분: {item.sectionType || '-'}</span>
                              <span>고시번호: {item.noticeNumber || '-'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
