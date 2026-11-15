import type {NewsBodyReader} from '../news/newsBodyReader';
import {runQueuedAnalysis} from './queuedAnalysis';
import type {AnalysisQueue} from '../queue/analysisQueue';
import type {AttachmentReader} from '../attachments/attachmentReader';
import { AssociationNoticeCollector } from '../collector/associationCollector';
import { evaluateDispatch } from '../notifier/dispatchPolicy';
import { EventDeduplicator } from '../analyzer/eventDeduplicator';
import { GeminiAnalyzer, AnalysisCache } from '../analyzer/geminiAnalyzer';
import { evaluateDeterministicGate } from '../analyzer/relatednessGate';
import { NewsCollector } from '../collector/newsCollector';
import { OfficialNoticeCollector, BusanCityNoticeCollector, GwacheonCityNoticeCollector } from '../collector/officialCollector';
import { REDEVELOPMENT_SEED_PROJECTS } from '../registry/redevelopmentRegistry';
import {
  CollectionCycleAudit,
  ExtractedEvent,
  ItemAuditRecord,
  RawCollectedItem,
  RedevelopmentProject,
} from '../types/redevelopment';

export interface PipelineRunOptions {
  newsReader?:NewsBodyReader;
  workQueue?:AnalysisQueue;
  attachmentReader?:AttachmentReader;
  projects?: readonly RedevelopmentProject[] | RedevelopmentProject[];
  timeoutMs?: number;
  existingEvents?: ExtractedEvent[];
  analysisCache?: AnalysisCache;
  /** Phase 3A: news-rss default enabled, official-api disabled until DATA_GO_KR_API_KEY approval */
  enableOfficialApi?: boolean;
}

export interface PipelineRunResult {
  queueReadyIds?:string[];
  aiUsage: GeminiAnalyzer['usage'];
  audit: CollectionCycleAudit;
  events: ExtractedEvent[];
  rawItems: RawCollectedItem[];
}

export async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, task: (item:T)=>Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length); let next=0;
  await Promise.all(Array.from({length:Math.min(items.length,Math.max(1,limit))}, async()=>{
    while(next<items.length){const index=next++;results[index]=await task(items[index]);}
  }));
  return results;
}

/**
 * Phase 2 Master Data Collection & Processing Pipeline
 *
 * Sequence:
 * 1. Fetch from Real Sources (Official Administration Notices & Public News RSS)
 * 2. 1st Pass: Deterministic Relatedness Gate
 * 3. 2nd Pass: Gemini Semantic Validation
 * 4. Gemini Event Extraction
 * 5. Multi-Source Event Clustering & Deduplication
 * 6. Telegram Candidate Evaluation (No real dispatch in Phase 2)
 * 7. Comprehensive Audit Metrics Generation ("Why no alert?")
 */
export class CollectionPipeline {
  private associationCollector = new AssociationNoticeCollector();
  private newsCollector: NewsCollector;
  private officialCollector: OfficialNoticeCollector;
  private cityBoardCollector = new BusanCityNoticeCollector();
  private gwacheonBoardCollector = new GwacheonCityNoticeCollector();
  private geminiAnalyzer: GeminiAnalyzer;
  private deduplicator: EventDeduplicator;

  constructor() {
    this.newsCollector = new NewsCollector();
    this.officialCollector = new OfficialNoticeCollector();
    this.geminiAnalyzer = new GeminiAnalyzer();
    this.deduplicator = new EventDeduplicator();
  }

  public async run(options: PipelineRunOptions = {}): Promise<PipelineRunResult> {
    this.officialCollector.beginRun?.();
    try {
      return await this.runInternal(options);
    } finally {
      this.officialCollector.endRun?.();
    }
  }

  private async runInternal(options: PipelineRunOptions): Promise<PipelineRunResult> {
    const processingDeadline=Date.now()+200000;
    this.geminiAnalyzer.beginRun(options.analysisCache,options.workQueue?processingDeadline:Infinity);
    const projects = options.projects || REDEVELOPMENT_SEED_PROJECTS;
    const isOfficialEnabled = (options.enableOfficialApi ?? true) && process.env.ENABLE_OFFICIAL_API !== 'false' && Boolean(process.env.DATA_GO_KR_API_KEY?.trim());
    const errors: string[] = [];
    const sourceDetails: CollectionCycleAudit['sourceDetails'] = [];

    const discoveredItems: RawCollectedItem[] = [];
    let relevantCount = 0;
    let irrelevantCount = 0;
    let uncertainCount = 0;

    let sourcesChecked = 0;

    // City notices are independent of the API key, shared across projects.
    sourcesChecked++;
    const city = await this.cityBoardCollector.fetchForProjects(projects.filter(p => p.city === '부산광역시'), {timeoutMs: options.timeoutMs || 15000});
    discoveredItems.push(...city.items);
    sourceDetails.push({sourceName: '부산광역시 공식 고시공고', sourceTier:'official', status:city.error?'failed':'success', itemsCount:city.items.length, error:city.error});
    if(city.error) errors.push(city.error);

    if (projects.some(p=>p.city==='과천시' && p.isActiveMonitoring)) {
      sourcesChecked++;
      const gc=await this.gwacheonBoardCollector.fetchForProjects(projects,{timeoutMs:options.timeoutMs||15000});
      discoveredItems.push(...gc.items);
      sourceDetails.push({sourceName:'과천시 공식 고시·공고',sourceTier:'official',status:gc.error?'failed':'success',itemsCount:gc.items.length,error:gc.error});
      if(gc.error)errors.push(gc.error);
    }

    // 1. COLLECT FROM REAL DATA SOURCES (Concurrent fetching across monitored projects)
    await Promise.all(
      projects.map(async (project) => {
        // 1-A. News RSS Collector
        sourcesChecked++;
        const newsResult = await this.newsCollector.fetchForProject(project, {
          timeoutMs: options.timeoutMs ?? 10000,
        });
        sourceDetails.push({
          sourceName: `Google News RSS (${project.name})`,
          sourceTier: 'news',
          status: newsResult.error ? 'failed' : 'success',
          itemsCount: newsResult.items.length,
          error: newsResult.error,
        });
        if (newsResult.error) {
          errors.push(newsResult.error);
        }
        discoveredItems.push(...newsResult.items);

        // 1-B. Official Notices Collector (Phase 3A: official-api disabled / pending auth by default)
        // Configuration permits requests; only successful upstream responses mark active.
        if (project.associationBoard) {
          sourcesChecked++;
          const association = await this.associationCollector.fetchForProject(project, { timeoutMs: options.timeoutMs || 15000 });
          sourceDetails.push({ sourceName: project.associationBoard.auditSourceName, sourceTier: 'official', status: association.error ? 'failed' : 'success', itemsCount: association.items.length, error: association.error });
          if (association.error) errors.push(association.error);
          discoveredItems.push(...association.items);
        }
        if (project.city !== '부산광역시') {
          // Busan Saaol credentials/endpoints do not cover other municipalities.
          return;
        }
        if (isOfficialEnabled) {
          sourcesChecked++;
          const officialResult = await this.officialCollector.fetchForProject(project, {
            timeoutMs: options.timeoutMs || 15000,
          });
          sourceDetails.push({
            sourceName: `${officialResult.sourceName} (${project.district})`,
            sourceTier: 'official',
            status: officialResult.error ? 'failed' : 'success',
            itemsCount: officialResult.items.length,
            error: officialResult.error,
          });
          if (officialResult.error) {
            errors.push(officialResult.error);
          }
          discoveredItems.push(...officialResult.items);
        } else {
          // official-api is disabled / unavailable in Phase 3A News-Only mode
          // Record as audit warning without stopping news-rss pipeline
          sourceDetails.push({
            sourceName: `부산광역시 새올고시정보 (${project.district})`,
            sourceTier: 'official',
            status: 'failed',
            itemsCount: 0,
            error: process.env.ENABLE_OFFICIAL_API === 'false' || options.enableOfficialApi === false ? '새올 API 명시 비활성' : '새올 API 키 미설정 (연결 미검증)',
          });
        }
      })
    );

    if(options.workQueue && options.attachmentReader){
      const processed=await runQueuedAnalysis({newsReader:options.newsReader,queue:options.workQueue,attachments:options.attachmentReader,analyzer:this.geminiAnalyzer,items:discoveredItems,projects,existingEvents:options.existingEvents||[],maxItems:Math.min(80,Math.max(1,Number(process.env.AI_MAX_ITEMS_PER_CYCLE)||80)),deadline:processingDeadline});
      const audit:CollectionCycleAudit={id:`audit_${Date.now()}`,timestamp:new Date().toISOString(),sourcesChecked,itemsDiscovered:discoveredItems.length,relevantItems:processed.audits.filter(a=>a.geminiRelatednessResult==='relevant').length,irrelevantItems:processed.audits.filter(a=>a.geminiRelatednessResult==='irrelevant').length,uncertainItems:processed.audits.filter(a=>a.geminiRelatednessResult==='uncertain'&&!a.reviewDisposition).length,eventsCreated:processed.eventsCreated,eventsMerged:processed.eventsMerged,telegramCandidates:processed.telegramCandidates,officialApiStatus:isOfficialEnabled?'active':'disabled',errors,sourceDetails,itemAudits:processed.audits,queueStats:processed.stats,queueAttempted:processed.attempted,explanationWhyNoAlert:`대기 ${processed.stats.pending||0}건 · 재시도 ${processed.stats.retry||0}건 · 검토 필요 ${processed.stats.needs_review||0}건. 미처리 자료는 원본 목록에서 사라져도 대기열에 보존됩니다.`};
      return {audit,events:processed.events,rawItems:processed.items,aiUsage:{...this.geminiAnalyzer.usage},queueReadyIds:processed.readyIds};
    }

    // 2. 1ST PASS: DETERMINISTIC GATE
    const passed1stGate: Array<{ item: RawCollectedItem; project: RedevelopmentProject; gateStatus: 'relevant' | 'irrelevant'; gateReason: string }> = [];
    const itemAuditMap = new Map<string, ItemAuditRecord>();

    const seenOfficialNotices = new Set<string>();
    const uniqueItems = discoveredItems.filter(item => {
      if(item.sourceTier !== 'official' || item.actorType === 'association') return true;
      const key = `${item.projectId}:${item.title.replace(/\s/g,'')}:${item.publishedAt.slice(0,10)}`;
      if(seenOfficialNotices.has(key)) return false;
      seenOfficialNotices.add(key); return true;
    });
    discoveredItems.splice(0, discoveredItems.length, ...uniqueItems);
    for (const item of discoveredItems) {
      const project = projects.find((p) => p.id === item.projectId) || projects[0];
      const gateResult = evaluateDeterministicGate(item, project);
      const matchedAlias = item.matchedKeywords.length > 0 ? item.matchedKeywords.join(', ') : project.aliases[0];

      // 72-hour Recency Policy check
      const pubTime = new Date(item.publishedAt).getTime();
      const discTime = new Date(item.collectedAt || new Date().toISOString()).getTime();
      const ageHours = (discTime - pubTime) / (1000 * 60 * 60);
      const isHistorical = ageHours > 72;
      const telegramEligibleByRecency = !isHistorical;

      if (gateResult.status === 'irrelevant') {
        irrelevantCount++;
        itemAuditMap.set(item.id, {
          projectId: item.projectId,
          matchedAlias,
          title: item.title,
          source: item.sourceName,
          sourceTier: item.sourceTier,
          sourceType: item.sourceType,
          publishedAt: item.publishedAt,
          sourceUrl: item.sourceUrl,
          deterministicGateResult: 'irrelevant',
          gateReason: gateResult.reason,
          geminiRelatednessResult: 'irrelevant',
          geminiReason: '1차 결정론적 게이트 탈락으로 LLM 평가 스킵',
          confidence: 0,
          eventType: 'none',
          importance: 0,
          telegramCandidate: false,
          discoveredAt: item.collectedAt,
          isHistorical,
          telegramEligibleByRecency,
          noticeNumber: item.noticeNumber,
          department: item.department,
          sectionType: item.sectionType,
        });
      } else {
        passed1stGate.push({ item, project, gateStatus: 'relevant', gateReason: gateResult.reason });
      }
    }

    // 3. 2ND PASS: GEMINI SEMANTIC VALIDATION (Parallelized)
    const itemsToExtract: Array<{ item: RawCollectedItem; project: RedevelopmentProject }> = [];

    // Cost/duration guard: analyse the newest items first and cap AI calls per cycle so one
    // burst of articles cannot push the cycle past the Cloud Run request timeout. Items over
    // the cap are reported as 'uncertain' and are picked up again on the next cycle.
    const maxAiItems = Math.max(1, Number(process.env.AI_MAX_ITEMS_PER_CYCLE) || 80);
    const chosen = new Set([...passed1stGate].sort((a, b) =>
      new Date(b.item.publishedAt).getTime() - new Date(a.item.publishedAt).getTime()).slice(0, maxAiItems));
    // Original order is preserved so event merging behaves exactly as before when under the cap.
    const toAnalyze = passed1stGate.filter(entry => chosen.has(entry));
    const deferred = passed1stGate.filter(entry => !chosen.has(entry));
    if (deferred.length > 0) {
      errors.push(`AI 분석 상한(${maxAiItems}건) 초과: ${deferred.length}건은 다음 주기로 이월`);
    }
    const semanticValidations = [
      ...(await mapWithConcurrency(
        toAnalyze, 4, async ({ item, project, gateReason }) => {
          const result = await this.geminiAnalyzer.validateRelatedness(item, project);
          return { item, project, gateReason, result };
        }
      )),
      ...deferred.map(({ item, project, gateReason }) => ({
        item, project, gateReason,
        result: { status: 'uncertain' as const, confidence: 0, explanation: 'AI 분석 상한 초과로 이번 주기 미분석 (다음 주기 재시도)' },
      })),
    ];

    for (const { item, project, gateReason, result } of semanticValidations) {
      const matchedAlias = item.matchedKeywords.length > 0 ? item.matchedKeywords.join(', ') : project.aliases[0];
      const pubTime = new Date(item.publishedAt).getTime();
      const discTime = new Date(item.collectedAt || new Date().toISOString()).getTime();
      const ageHours = (discTime - pubTime) / (1000 * 60 * 60);
      const isHistorical = ageHours > 72;
      const telegramEligibleByRecency = !isHistorical;

      if (result.status === 'irrelevant') {
        irrelevantCount++;
        itemAuditMap.set(item.id, {
          projectId: item.projectId,
          matchedAlias,
          title: item.title,
          source: item.sourceName,
          sourceTier: item.sourceTier,
          sourceType: item.sourceType,
          publishedAt: item.publishedAt,
          sourceUrl: item.sourceUrl,
          deterministicGateResult: 'relevant',
          gateReason,
          geminiRelatednessResult: 'irrelevant',
          geminiReason: result.explanation,
          confidence: result.confidence,
          eventType: 'none',
          importance: 0,
          telegramCandidate: false,
          discoveredAt: item.collectedAt,
          isHistorical,
          telegramEligibleByRecency,
          noticeNumber: item.noticeNumber,
          department: item.department,
          sectionType: item.sectionType,
        });
      } else if (result.status === 'uncertain') {
        uncertainCount++;
        itemAuditMap.set(item.id, {
          projectId: item.projectId,
          matchedAlias,
          title: item.title,
          source: item.sourceName,
          sourceTier: item.sourceTier,
          sourceType: item.sourceType,
          publishedAt: item.publishedAt,
          sourceUrl: item.sourceUrl,
          deterministicGateResult: 'relevant',
          gateReason,
          geminiRelatednessResult: 'uncertain',
          geminiReason: result.explanation,
          confidence: result.confidence,
          eventType: 'none',
          importance: 0,
          telegramCandidate: false,
          discoveredAt: item.collectedAt,
          isHistorical,
          telegramEligibleByRecency,
          noticeNumber: item.noticeNumber,
          department: item.department,
          sectionType: item.sectionType,
        });
      } else {
        relevantCount++;
        itemsToExtract.push({ item, project });
        itemAuditMap.set(item.id, {
          projectId: item.projectId,
          matchedAlias,
          title: item.title,
          source: item.sourceName,
          sourceTier: item.sourceTier,
          sourceType: item.sourceType,
          publishedAt: item.publishedAt,
          sourceUrl: item.sourceUrl,
          deterministicGateResult: 'relevant',
          gateReason,
          geminiRelatednessResult: 'relevant',
          geminiReason: result.explanation,
          confidence: result.confidence,
          eventType: 'pending',
          importance: 0,
          telegramCandidate: false,
          discoveredAt: item.collectedAt,
          isHistorical,
          telegramEligibleByRecency,
          noticeNumber: item.noticeNumber,
          department: item.department,
          sectionType: item.sectionType,
        });
      }
    }

    // 4. EVENT EXTRACTION (Parallelized)
    const extractedPayloads = await Promise.all(
      itemsToExtract.map(async ({ item, project }) => {
        const payload = await this.geminiAnalyzer.extractEvent(item, project);
        return { payload, rawItem: item };
      })
    );

    // Update item audits with extracted event details
    for (const { payload, rawItem } of extractedPayloads) {
      const existingAudit = itemAuditMap.get(rawItem.id);
      if (existingAudit) {
        existingAudit.eventType = payload.eventType;
        existingAudit.importance = payload.importance;
        // Telegram candidate: 중요도 4등급 이상 AND 신뢰도 0.75 이상 AND 최신성 적격 (72h 이내)
        // 협력업체/용역업체 입찰은 기본 2~3등급이므로 텔레그램 발송 후보에서 자동 제외됨
        const event = this.deduplicator.deduplicateAndMerge([{ payload, rawItem }]).events[0];
        existingAudit.telegramCandidate = evaluateDispatch(event).eligible;
      }
    }

    // 5. EVENT DEDUPLICATION & TELEGRAM CANDIDATE CALCULATION
    const dedupResult = this.deduplicator.deduplicateAndMerge(
      extractedPayloads,
      options.existingEvents || []
    );

    for (const audit of itemAuditMap.values()) {
      if (audit.telegramCandidate) audit.telegramCandidate = dedupResult.events.some(e => e.sources.some(s => s.url === audit.sourceUrl) && evaluateDispatch(e).eligible);
    }
    // 6. AUDIT & EXPLANATION FOR "WHY NO ALERT?"
    const explanationWhyNoAlert = this.generateWhyNoAlertExplanation({
      itemsDiscovered: discoveredItems.length,
      relevantItems: relevantCount,
      irrelevantItems: irrelevantCount,
      uncertainItems: uncertainCount,
      telegramCandidates: dedupResult.telegramCandidates,
      events: dedupResult.events,
      errors,
    });

    const itemAudits = Array.from(itemAuditMap.values());

    const officialErrors = sourceDetails.filter(s => s.sourceName.includes('새올고시') && s.status === 'failed');
    const officialApiStatus: CollectionCycleAudit['officialApiStatus'] = isOfficialEnabled
      ? officialErrors.length > 0
        ? 'failed'
        : 'active'
      : 'disabled';

    const audit: CollectionCycleAudit = {
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      sourcesChecked,
      itemsDiscovered: discoveredItems.length,
      relevantItems: relevantCount,
      irrelevantItems: irrelevantCount,
      uncertainItems: uncertainCount,
      eventsCreated: dedupResult.eventsCreated,
      eventsMerged: dedupResult.eventsMerged,
      telegramCandidates: dedupResult.telegramCandidates,
      officialApiStatus,
      errors,
      sourceDetails,
      itemAudits,
      explanationWhyNoAlert,
    };

    return {
      aiUsage: { ...this.geminiAnalyzer.usage },
      audit,
      events: dedupResult.events,
      rawItems: discoveredItems,
    };
  }

  /**
   * Generates a clear explanation for users asking "Why was there no alert in this cycle?"
   */
  private generateWhyNoAlertExplanation(params: {
    itemsDiscovered: number;
    relevantItems: number;
    irrelevantItems: number;
    uncertainItems: number;
    telegramCandidates: number;
    events: ExtractedEvent[];
    errors: string[];
  }): string {
    if (params.telegramCandidates > 0) {
      return `총 ${params.telegramCandidates}건의 중대 변곡점(4등급 이상)이 감지되어 텔레그램 발송 후보로 등록되었습니다.`;
    }

    if (params.itemsDiscovered === 0) {
      if (params.errors.length > 0) {
        return `수집 소스 확인 실패 ${params.errors.length}건. 변화 없음으로 판정할 수 없으며 다음 실행에 재확인이 필요합니다.`;
      }
      return '확인한 수집 소스에서 신규 관련 자료가 발견되지 않았습니다. 비활성·미설정 소스는 감사 로그를 확인하세요.';
    }

    if (params.errors.length > 0) return `일부 소스 확인 실패 ${params.errors.length}건. 확인한 자료에서는 발송 대상이 없으며 전체 변화 여부는 미확인입니다.`;
    if (params.relevantItems === 0) {
      return `수집된 자료 ${params.itemsDiscovered}건 모두 단순 부동산 시황 기사 또는 대상 구역과 직접적 연관이 없는 자료(irrelevant: ${params.irrelevantItems}건)로 판정되어 필터링되었습니다.`;
    }

    // Relevant items exist, but importance is < 4
    const nonCandidates = params.events.filter((e) => !e.telegramCandidate);
    if (nonCandidates.length > 0) {
      const reasons = nonCandidates
        .slice(0, 2)
        .map((e) => `[${e.title}] (${e.telegramCandidateReason || `중요도 ${e.importance}등급`})`)
        .join(', ');
      return `관련 자료 ${params.relevantItems}건이 추출되었으나, 공통 발송 조건에 따라 제외되었습니다: ${reasons}.`;
    }

    return '조건을 충족하는 신규 텔레그램 발송 후보 이벤트가 없습니다.';
  }
}
