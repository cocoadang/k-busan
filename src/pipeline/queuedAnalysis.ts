import type {RawCollectedItem,RedevelopmentProject,ItemAuditRecord,ExtractedEvent} from '../types/redevelopment';
import {evaluateDeterministicGate} from '../analyzer/relatednessGate';
import {EventDeduplicator} from '../analyzer/eventDeduplicator';
import {GeminiAnalyzer,AnalysisResult} from '../analyzer/geminiAnalyzer';
import {AnalysisQueue,queueId,QueueEntry} from '../queue/analysisQueue';
import {AttachmentReader} from '../attachments/attachmentReader';
export async function runQueuedAnalysis(options:{queue:AnalysisQueue;attachments:AttachmentReader;analyzer:GeminiAnalyzer;items:RawCollectedItem[];projects:readonly RedevelopmentProject[];existingEvents:ExtractedEvent[];maxItems:number;deadline?:number}){
 const {queue,attachments,analyzer,projects}=options;const byProject=new Map(projects.map(p=>[p.id,p]));
 const eligible=options.items.filter(i=>{const p=byProject.get(i.projectId);return p && evaluateDeterministicGate(i,p).status!=='irrelevant';});
 const fresh=await queue.enqueue(eligible); // Durable write BEFORE the first provider call.
 const due=await queue.next(options.maxItems),results=new Map<string,{item:RawCollectedItem;result?:AnalysisResult;error?:string}>(),readyIds:string[]=[],payloads:any[]=[];
 let cursor=0,attempted=0;
 await Promise.all(Array.from({length:Math.min(4,due.length)},async()=>{while(cursor<due.length){const entry=due[cursor++];if(options.deadline && Date.now()>=options.deadline)continue;const project=byProject.get(entry.item.projectId);if(!project){await queue.stage(entry,entry.item,{validation:{status:'uncertain',confidence:0,explanation:'모니터링 구역 설정 확인 필요'}});continue;}
  let item=entry.item,result=entry.result;
  if(entry.state!=='ready'){
   attempted++;
   try{item=await attachments.enrich(item,options.deadline);const validation=await analyzer.validateRelatedness(item,project);result={validation};if(validation.status==='relevant')result.payload=await analyzer.extractEvent(item,project);await queue.stage(entry,item,result);}
   catch(e:any){const error=/^ATTACHMENT_/.test(e.message)?e.message:'QUEUE_ANALYSIS_FAILED';await queue.stage(entry,item,undefined,error);results.set(entry.id,{item,error});continue;}
  }
  results.set(entry.id,{item,result});
  if(result && result.validation.status!=='uncertain'){readyIds.push(entry.id);if(result.payload)payloads.push({rawItem:item,payload:result.payload});}
 }}));
 const merged=new EventDeduplicator().deduplicateAndMerge(payloads,options.existingEvents);
 const items=[...new Map([...options.items,...due.map(e=>results.get(e.id)?.item||e.item)].map(i=>[queueId(i),i])).values()];
 const audits:ItemAuditRecord[]=items.map(item=>{const project=byProject.get(item.projectId)!;const gate=project?evaluateDeterministicGate(item,project):{status:'irrelevant',reason:'비활성 구역'};const row=results.get(queueId(item));const saved=fresh.get(queueId(item));const result=row?.result || (saved?.state==='completed'?saved.result:undefined);const status=gate.status==='irrelevant'?'irrelevant':result?.validation.status||'uncertain';const historical=Date.now()-Date.parse(item.publishedAt)>72*3600000;
  return {projectId:item.projectId,matchedAlias:item.matchedKeywords.join(', '),title:item.title,source:item.sourceName,sourceTier:item.sourceTier,sourceType:item.sourceType,publishedAt:item.publishedAt,sourceUrl:item.sourceUrl,deterministicGateResult:gate.status==='irrelevant'?'irrelevant':'relevant',gateReason:gate.reason,geminiRelatednessResult:status,geminiReason:result?.validation.explanation||row?.error||(gate.status==='irrelevant'?'결정론적 필터 제외':'미처리 대기열에 보관됨'),confidence:result?.validation.confidence||0,eventType:result?.payload?.eventType||'none',importance:result?.payload?.importance||0,telegramCandidate:merged.events.some(e=>e.telegramCandidate&&e.sources.some(s=>s.url===item.sourceUrl)),discoveredAt:item.collectedAt,isHistorical:historical,telegramEligibleByRecency:!historical,noticeNumber:item.noticeNumber};
 });
 return {items,audits,events:merged.events,eventsCreated:merged.eventsCreated,eventsMerged:merged.eventsMerged,telegramCandidates:merged.telegramCandidates,readyIds,stats:await queue.stats(),attempted};
}
