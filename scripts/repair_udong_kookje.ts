/** Targeted, audited repair for the one reviewed Kookje source. No notifier or AI credentials required. */
import {Firestore} from '@google-cloud/firestore';
import {FirestoreService} from '../src/storage/firestoreService';
import {NewsBodyReader,firestoreNewsBodyCache} from '../src/news/newsBodyReader';
import {newsDateSupported} from '../src/news/newsDateEvidence';
const ID='9f5fd0518d8c2223473fa394bb2dc5460be7a7c2c721c94c6fff431d2eca8580';
const LEGACY='evt_udong-3_43f41afea7782a11c39ca5f0';
const FINGERPRINT='7be416ea630f30cacd6d6c311f3b2395046948221dfbfb8e097f2ec743685ac1';
const SHA='d0f5ad88f12446743bf80a2a48daab793e3582c7bf1d1fbe3253b87040e2d6e0';
async function main(){
 const apply=process.env.APPLY_UDONG_NEWS_REPAIR==='true';
 if(process.env.TELEGRAM_BOT_TOKEN||process.env.TELEGRAM_CHAT_ID)throw Error('NOTIFICATION_CREDENTIALS_FORBIDDEN');
 const db=new Firestore({projectId:'busan-redevelopment',databaseId:'(default)',ignoreUndefinedProperties:true});
 const svc=new FirestoreService({firestore:db}),owner='udong_body_repair_'+Date.now();let locked=false;
 try{
  if(apply){locked=await svc.acquirePollLock(owner,600000,{production:true});if(!locked)throw Error('POLL_IN_PROGRESS');}
  const queue=db.collection('analysisQueue').doc(ID),legacy=db.collection('events').doc(LEGACY);
  const audit=db.collection('analysisReviewCorrections').doc('kookje_body_repair_'+ID);
  const [q,l,a]=await db.getAll(queue,legacy,audit);const old=q.data() as any,before=l.data() as any;
  if(a.exists)throw Error('REPAIR_ALREADY_APPLIED');
  if(old?.fingerprint!==FINGERPRINT||old.state!=='needs_review'||old.lastError!=='NEWS_BODY_UNAVAILABLE')throw Error('QUEUE_PRECONDITION_FAILED');
  if(before?.eventDate!=='2025-02-16'||before.projectId!=='udong-3'||before.primarySource?.url!==old.item.sourceUrl||before.sources?.length)throw Error('LEGACY_SOURCE_PRECONDITION_FAILED');
  const reader=new NewsBodyReader(),body=await reader.read(old.item),item=await new NewsBodyReader({get:async()=>body,set:async()=>{}}).enrich(old.item);
  if(body.sha256!==SHA||body.selector!=='.news_article'||body.publishedAt!=='2025-02-16T10:20:58.000Z'||!body.url.startsWith('https://www.kookje.co.kr/news2011/asp/newsbody.asp?'))throw Error('BODY_CHANGED_REVIEW_REQUIRED');
  const quote='지난 14일 해운대구로부터 사업시행계획인가를 통보받았다고';
  if(!newsDateSupported(item,'2025-02-14',quote))throw Error('DATE_NOT_VERIFIED');
  const summary={mode:apply?'applied':'dry_run',queueId:ID,legacyId:LEGACY,url:body.url,sha256:body.sha256,selector:body.selector,bodyLength:body.text.length,publication:body.publishedAt,expectedEventDate:'2025-02-14',telegramSent:0,aiRequests:0};
  if(apply){
   await firestoreNewsBodyCache(db).set(old.item.sourceUrl,body);
   await db.runTransaction(async tx=>{
    const [current,event,marker]=await Promise.all([tx.get(queue),tx.get(legacy),tx.get(audit)]);
    if(marker.exists||JSON.stringify(current.data())!==JSON.stringify(old)||JSON.stringify(event.data())!==JSON.stringify(before))throw Error('DATA_CHANGED_DURING_REVIEW');
    tx.create(audit,{kind:'news_body_repair',beforeQueue:old,beforeEvent:before,...summary,reviewedAt:new Date(),reason:'국제신문 본문 영역 누락을 수정하고, 제목만 읽어 발행일을 사건일로 저장한 동일 출처 이력을 백업 후 재처리합니다.'});
    tx.delete(legacy);
    const next={...old,state:'pending',nextAttemptAt:0,updatedAt:Date.now(),reviewApproval:{mode:'source_review',reason:'언론사 본문·발행일과 인가 통보일 근거 확인 후 정상 분석 경로로 재처리합니다.',evidenceUrls:[body.url],reviewedAt:Date.now()}};delete next.lastError;delete next.result;
    tx.set(queue,next);
   });
  }
  console.log('UDONG_REPAIR '+JSON.stringify(summary));
 }finally{if(locked)await svc.releasePollLock(owner);await db.terminate();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
