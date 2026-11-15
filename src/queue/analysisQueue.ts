import {createHash} from 'node:crypto';
import type {RawCollectedItem} from '../types/redevelopment';
import type {AnalysisResult} from '../analyzer/geminiAnalyzer';
import {ANALYSIS_VERSION,resolveGeminiModel} from '../analyzer/geminiAnalyzer';
export type ReviewResolution={kind:'not_event'|'unverified_claim'|'date_unconfirmed'|'duplicate'|'superseded';reason:string;evidenceUrls:string[];reviewedAt:number};
export type QueueEntry={id:string;fingerprint:string;item:RawCollectedItem;state:'pending'|'retry'|'ready'|'completed'|'needs_review'|'closed';resolution?:ReviewResolution;reviewApproval?:{mode:'model_checked'|'source_review';reason:string;evidenceUrls:string[];reviewedAt:number};firstSeenAt:number;updatedAt:number;attempts:number;nextAttemptAt?:number;result?:AnalysisResult;lastError?:string};
export function closeReviewedEntry(entry:QueueEntry,resolution:ReviewResolution,now=Date.now()):QueueEntry{if(entry.state!=='needs_review'||resolution.reason.trim().length<10||!resolution.evidenceUrls.length||resolution.evidenceUrls.some(x=>{try{return new URL(x).protocol!=='https:';}catch{return true;}}))throw Error('INVALID_REVIEW_RESOLUTION');const next={...entry,state:'closed' as const,resolution,updatedAt:now};delete next.nextAttemptAt;return next;}
export interface AnalysisQueue {enqueue(items:RawCollectedItem[]):Promise<Map<string,QueueEntry>>;next(limit:number):Promise<QueueEntry[]>;stage(entry:QueueEntry,item:RawCollectedItem,result?:AnalysisResult,error?:string):Promise<void>;ack(ids:string[]):Promise<void>;stats():Promise<Record<string,number>>;}
export const queueId=(item:RawCollectedItem)=>createHash('sha256').update(JSON.stringify([item.projectId,item.sourceUrl])).digest('hex');
export function queueFingerprint(item:RawCollectedItem){return createHash('sha256').update(JSON.stringify([ANALYSIS_VERSION,resolveGeminiModel(),item.projectId,item.sourceUrl,item.title,item.content,item.publishedAt,item.sourceType,item.noticeNumber,item.attachmentUrls||[]])).digest('hex');}
export function enqueueEntry(item:RawCollectedItem,old:QueueEntry|undefined,now:number):QueueEntry{
 const fingerprint=queueFingerprint(item);
 if(old?.fingerprint===fingerprint && !(old.state==='completed' && item.attachmentUrls?.length && now-old.updatedAt>86400000))return old;
 return {id:queueId(item),fingerprint,item,state:'pending',firstSeenAt:old?.firstSeenAt??now,updatedAt:now,attempts:0,nextAttemptAt:old?.firstSeenAt??now};
}
export function stageEntry(entry:QueueEntry,item:RawCollectedItem,result:AnalysisResult|undefined,error:string|undefined,now:number):QueueEntry{
 const attempts=entry.attempts+1;
 const permanent=!!error&&/^NEWS_(?:HOST_REJECTED|TITLE_MISMATCH|BODY_UNAVAILABLE|BODY_LIMIT|ACCESS_RESTRICTED|LINK_INVALID|CHARSET_UNSUPPORTED|HTTP_(?:403|404|410|429))$/.test(error);
 const transient=(!permanent&&!!error) || (result?.validation.status==='uncertain' && /AI 분석 실패|TIMEOUT|AI_UNAVAILABLE/.test(result.validation.explanation));
 const state=permanent?'needs_review':transient?(attempts>=5?'needs_review':'retry'):result?.validation.status==='uncertain'?'needs_review':'ready';
 const next={...entry,item,result,state,attempts,updatedAt:now,lastError:error|| (state==='retry'||state==='needs_review'?result?.validation.explanation:undefined)} as QueueEntry;
 if(state==='retry')next.nextAttemptAt=now+[60000,300000,1800000,21600000][Math.min(attempts-1,3)];
 else if(state==='ready')next.nextAttemptAt=0;
 else delete next.nextAttemptAt;
 return next;
}
const plain=(v:any)=>JSON.parse(JSON.stringify(v));
/** Must run under the existing durable polling lock. Ready results are replayed until event persistence is acknowledged. */
export class FirestoreAnalysisQueue implements AnalysisQueue {
 constructor(private db:any,private now=Date.now){}
 private collection(){if(!this.db)throw Error('ANALYSIS_QUEUE_UNAVAILABLE');return this.db.collection('analysisQueue');}
 async enqueue(items:RawCollectedItem[]){const unique=[...new Map(items.map(i=>[queueId(i),i])).values()],out=new Map<string,QueueEntry>();
  for(let at=0;at<unique.length;at+=200){const chunk=unique.slice(at,at+200),refs=chunk.map(i=>this.collection().doc(queueId(i))),docs=await this.db.getAll(...refs),batch=this.db.batch();let writes=0;
   chunk.forEach((item,n)=>{const old=docs[n].data() as QueueEntry|undefined,next=enqueueEntry(item,old,this.now());out.set(next.id,next);if(next!==old){batch.set(refs[n],plain(next));writes++;}});if(writes)await batch.commit();}
  return out;
 }
 async next(limit:number){const snap=await this.collection().where('nextAttemptAt','<=',this.now()).orderBy('nextAttemptAt','asc').limit(limit).get();return snap.docs.map((d:any)=>d.data() as QueueEntry);}
 async stage(entry:QueueEntry,item:RawCollectedItem,result?:AnalysisResult,error?:string){const next=stageEntry(entry,item,result,error,this.now());await this.collection().doc(entry.id).set(plain(next));}
 async ack(ids:string[]){for(const id of [...new Set(ids)])await this.db.runTransaction(async(tx:any)=>{const ref=this.collection().doc(id),snap=await tx.get(ref),entry=snap.data() as QueueEntry|undefined;if(entry?.state==='ready'){const next={...entry,state:'completed',updatedAt:this.now()};delete next.nextAttemptAt;tx.set(ref,plain(next));}});}
 async stats(){const out:Record<string,number>={};for(const state of ['pending','retry','ready','completed','needs_review','closed'])out[state]=(await this.collection().where('state','==',state).count().get()).data().count;return out;}
}
