// Synthetic HTML shaped around the independently identified public announcement.
// This is a parser contract fixture, NOT a captured/verified upstream HTML page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AssociationNoticeCollector, readAssociationHtml, parseAssociationList, canonicalAssociationUrl, parseKstDate } from '../collector/associationCollector';
import { OfficialNoticeCollector, getKstDateString } from '../collector/officialCollector';
import { CollectionPipeline, mapWithConcurrency } from '../pipeline/collectionPipeline';
import { EventDeduplicator } from '../analyzer/eventDeduplicator';
import { GeminiAnalyzer, analysisCacheKey, compactAnalysisContent } from '../analyzer/geminiAnalyzer';
import { evaluateDispatch, validateMaterialEvidence } from '../notifier/dispatchPolicy';
import { TelegramNotifier } from '../notifier/telegramNotifier';
import { REDEVELOPMENT_SEED_PROJECTS } from '../registry/redevelopmentRegistry';
import type { ExtractedEvent, RawCollectedItem } from '../types/redevelopment';
const project = REDEVELOPMENT_SEED_PROJECTS.find(p=>p.id==='chokjin-3')!;
const title = '촉진3구역입찰공고 - 협력업체 [기반시설공사 건설사업관리] [부지정지공사]선정 입찰 공고';
const url = 'https://dynamice.busan.go.kr/home/BARA_0000000000151/view.do?no=329&ntt_id=20680&pgMode=view';
const now = new Date('2026-10-10T03:13:43Z');
const list = (date='2026-10-08', extra='') => `<html><title>입찰공고</title><table><tr><td><a href="${url.replaceAll('&','&amp;')}&amp;utm_source=chatgpt.com">${title}</a></td><td>${date}</td></tr>${extra}</table></html>`;
const quote = '조합은 착공 예정일을 2026년 11월 15일에서 2027년 2월 1일로 연기하기로 의결했다.';
const raw: RawCollectedItem = { id:'fixture', projectId: project.id, sourceTier:'official', sourceType:'official-web', sourceName:'조합', sourceUrl:canonicalAssociationUrl(url), title, content:quote, publishedAt:'2026-10-08T00:00:00+09:00', collectedAt:now.toISOString(), rawFingerprint:'association:chokjin-3:20680', matchedKeywords:['촉진3'], actorType:'association', detailVerified:true };
const input = { kind:'schedule', certainty:'scheduled', quote, change:'착공 예정 연기', practicalMeaning:'후속 분양 일정 재확인 필요' };
const evidence = validateMaterialEvidence(input, raw)!;
const event = (extra: Partial<ExtractedEvent>={}): ExtractedEvent => ({ id:'event-fixture', projectId:project.id, eventType:'협력업체/용역 입찰공고', category:'사업단계',title, summary:'예정 변경',importance:4,confidence:.9,eventDate:'2026-10-08',primarySourceUrl:raw.sourceUrl,primarySourceTier:'official',sources:[{ title, url:raw.sourceUrl,source:'조합',sourceTier:'official',publishedAt:raw.publishedAt,discoveredAt:raw.collectedAt,detailVerified:true,evidenceContent:quote }],reasoningSummary:'원문 근거',telegramCandidate:false,publishedAt:raw.publishedAt,createdAt:now.toISOString(),updatedAt:now.toISOString(),...extra });

test('공고 제목·게시일·canonical URL과 조합 provenance 보존',async()=>{
 const fetcher = (async(u:any)=>new Response(String(u).includes('ntt_id')?`<html><div class="bbs_view_cont">${quote}</div><a href="/download.do?id=1">첨부</a></html>`:list(),{headers:{'content-type':'text/html'}})) as typeof fetch;
 const r=await new AssociationNoticeCollector(fetcher,()=>now).fetchForProject(project);
 assert.match(r.error!,/ATTACHMENT_CONTENT_UNVERIFIED/); assert.equal(r.items[0].attachmentContentStatus,"unverified"); assert.equal(r.items.length,1); assert.equal(r.items[0].title,title); assert.equal(r.items[0].publishedAt,'2026-10-08T00:00:00+09:00'); assert.equal(r.items[0].sourceUrl,canonicalAssociationUrl(url)); assert.equal(r.items[0].actorType,'association'); assert.equal(r.items[0].detailVerified,true); assert.equal(r.items[0].attachmentUrls?.length,1);
});
test('목록 접근 실패를 성공0건으로 보고하지 않음',async()=>{
 const r=await new AssociationNoticeCollector((async()=>new Response('',{status:502})) as typeof fetch,()=>now).fetchForProject(project);
 assert.ok(r.error?.includes('502'));assert.equal(r.items.length,0);
});
test('상세 실패 시 제목 보존·확인 불가·증거 승격 차단',async()=>{
 const r=await new AssociationNoticeCollector((async(u:any)=>new Response(String(u).includes('ntt_id')?'':list(),{status:String(u).includes('ntt_id')?502:200})) as typeof fetch,()=>now).fetchForProject(project);
 assert.equal(r.items.length,1);assert.equal(r.items[0].detailVerified,false);assert.ok(r.error);assert.equal(validateMaterialEvidence(input,r.items[0]),undefined);
});
test('미확인 HTML·게시일 누락은 parse 실패',()=>{
 assert.throws(()=>parseAssociationList('<html>login</html>'));
 assert.throws(()=>parseAssociationList(list('날짜없음')));
 assert.equal(parseKstDate('2026-02-31'),undefined);
});
test('목록 중복 수집 제거',async()=>{
 const extra=`<tr><td><a href="${url}">${title}</a></td><td>2026-10-08</td></tr>`;
 const r=await new AssociationNoticeCollector((async(u:any)=>new Response(String(u).includes('ntt_id')?`<div class="bbs_view_cont">${quote}</div>`:list('2026-10-08',extra))) as typeof fetch,()=>now).fetchForProject(project);
 assert.equal(r.items.length,1);
});
test('최근72시간 경계와 미래 자료 제외',async()=>{
 for(const [date,count] of [['2026-10-07 12:13:43',1],['2026-10-07 12:13:42',0],['2026-10-11',0]] as const){
 const r=await new AssociationNoticeCollector((async(u:any)=>new Response(String(u).includes('ntt_id')?`<div class="bbs_view_cont">${quote}</div>`:list(date))) as typeof fetch,()=>now).fetchForProject(project);assert.equal(r.items.length,count,date);
 }
});
test('일반 협력업체 입찰은 고중요로 표시돼도 근거 없이 불발송',()=>{
 assert.equal(evaluateDispatch(event(),4,now.getTime()).eligible,false);
});
test('원문 근거 있는 중요 예정 변경만 vendor 예외',()=>{
 assert.ok(evidence);assert.equal(evaluateDispatch(event({materialImpactEvidence:evidence}),4,now.getTime()).eligible,true);
 assert.equal(evaluateDispatch(event({materialImpactEvidence:evidence,importance:3}),4,now.getTime()).eligible,false);
 assert.equal(evaluateDispatch(event({materialImpactEvidence:evidence,alreadyDispatched:true}),4,now.getTime()).eligible,false);
 assert.equal(evaluateDispatch(event({materialImpactEvidence:evidence,confidence:NaN}),4,now.getTime()).eligible,false);
});
test('AI 가공 인용·키워드·상세 미확인만으로 예외 생성 불가',()=>{
 assert.equal(validateMaterialEvidence({...input,quote:'이 문장은 실제 공고에 없는 허위 인용입니다 2026년 11월 착공'},raw),undefined);
 assert.equal(validateMaterialEvidence({...input,quote:'착공 준비에 필요한 업체 선정 절차를 진행합니다.'},{...raw,content:'착공 준비에 필요한 업체 선정 절차를 진행합니다.'}),undefined);
 assert.equal(validateMaterialEvidence({...input,change:4},raw),undefined);
});
test('dedup·notifier 공통정책 일치와 가짜 sender 검증',async()=>{
 const restore=Date.now;Date.now=()=>now.getTime();
 try{
 let calls=0;const notifier=new TelegramNotifier({customSender:async()=>{calls++;return {success:true};}});
 const payload:any={...event(),sourceUrl:raw.sourceUrl,sourceTier:'official',clusterKey:'vendor',materialImpactEvidence:evidence};
 const dedup=new EventDeduplicator();const first=dedup.deduplicateAndMerge([{payload,rawItem:raw}]);const e=first.events[0];
 assert.equal(e.sourceTier,'association');assert.equal(e.telegramCandidate,notifier.qualifiesForDispatch(e).eligible);assert.equal(e.telegramCandidate,true);
 await notifier.dispatchEvent(e,project);assert.equal(calls,1);
 const repeat=dedup.deduplicateAndMerge([{payload,rawItem:raw}],[{...e,alreadyDispatched:true}]);assert.equal(repeat.eventsCreated,0);assert.equal(repeat.telegramCandidates,0);
 const second=dedup.deduplicateAndMerge([{payload,rawItem:{...raw,sourceUrl:raw.sourceUrl.replace('20680','20681')}}],first.events);assert.equal(second.events.length,2);assert.notEqual(second.events[0].id,second.events[1].id);
 }finally{Date.now=restore;}
});
test('새올 KST 조회 날짜는 서버 timezone과 독립',()=>{
 assert.equal(getKstDateString(0,new Date('2026-10-07T15:00:00Z')),'20261008');assert.equal(getKstDateString(-3,now),'20261007');
});
test('새올 키 없는 경우 명시 실패, 활성화 시 7일 mocked fetch',async()=>{
 const previous=process.env.DATA_GO_KR_API_KEY;const original=globalThis.fetch;const dates:string[]=[];
 try{
 delete process.env.DATA_GO_KR_API_KEY;
 const c=new OfficialNoticeCollector();assert.equal((await c.fetchRawPage({pbltnYmd:'20261008'})).success,false);
 process.env.DATA_GO_KR_API_KEY='test-only-key';
 globalThis.fetch=(async(u:any)=>{dates.push(new URL(String(u)).searchParams.get('pbltnYmd')!);return new Response(JSON.stringify({response:{header:{resultCode:'00'},body:{totalCount:0,items:{}}}}),{headers:{'content-type':'application/json'}});}) as typeof fetch;
 const r=await c.fetchForProject(project);assert.equal(r.error,undefined);assert.equal(dates.length,7);
 }finally{globalThis.fetch=original;if(previous===undefined)delete process.env.DATA_GO_KR_API_KEY;else process.env.DATA_GO_KR_API_KEY=previous;}
});
test('pipeline audit와 notifier 후보 일치·새올 설정 상태·조합 장애 분리',async()=>{
 const prev=process.env.DATA_GO_KR_API_KEY;const originalNow=Date.now;Date.now=()=>now.getTime();
 try{
 process.env.DATA_GO_KR_API_KEY='test-only';
 const p:any=new CollectionPipeline();
 p.cityBoardCollector={fetchForProjects:async()=>({items:[]})};
 p.newsCollector={fetchForProject:async()=>({items:[]})};
 p.officialCollector={fetchForProject:async()=>({items:[raw],sourceName:'부산광역시 새올고시정보'})};
 p.geminiAnalyzer=new GeminiAnalyzer({dryRunMode:true});
 // The association collector is injected for offline regression, no public fetch.
 p.associationCollector={fetchForProject:async()=>({items:[],error:'test: upstream unavailable'})};
 const r=await p.run({projects:[project]});
 assert.equal(r.audit.officialApiStatus,'active');assert.ok(r.audit.errors.length);
 assert.equal(r.audit.itemAudits[0].telegramCandidate,new TelegramNotifier().qualifiesForDispatch(r.events[0]).eligible);
 const disabled=await p.run({projects:[project],enableOfficialApi:false});assert.equal(disabled.audit.officialApiStatus,'disabled');
 }finally{Date.now=originalNow;if(prev===undefined)delete process.env.DATA_GO_KR_API_KEY;else process.env.DATA_GO_KR_API_KEY=prev;}
});

test('새올 raw/encoded 키는 한 번만 인코딩하고 공백 제거', async()=>{
 const previous=process.env.DATA_GO_KR_API_KEY; const originalFetch=globalThis.fetch;
 try {
  for(const key of ['  test+/=  ','test%2B%2F%3D']) {
   process.env.DATA_GO_KR_API_KEY=key;
   globalThis.fetch=(async(u:any)=>{assert.equal(new URL(String(u)).searchParams.get('serviceKey'),'test+/=');return new Response(JSON.stringify({response:{header:{resultCode:'00'},body:{totalCount:0,items:{}}}}),{headers:{'content-type':'application/json'}});}) as typeof fetch;
   assert.equal((await new OfficialNoticeCollector().fetchRawPage({pbltnYmd:'20261010'})).success,true);
  }
 } finally {globalThis.fetch=originalFetch;if(previous===undefined)delete process.env.DATA_GO_KR_API_KEY;else process.env.DATA_GO_KR_API_KEY=previous;}
});

test('새올 XML NODATA는 성공 0건, 인증 오류는 실패', async()=>{
 const previous=process.env.DATA_GO_KR_API_KEY; const originalFetch=globalThis.fetch;
 try {
  process.env.DATA_GO_KR_API_KEY='fixture';
  for(const [body,status,expected,code] of [
   ['<result><resultMsg>NODATA_ERROR</resultMsg><resultCode>03</resultCode></result>',200,true,'03'],
   ['<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>',403,false,'30'],
   ['<html><body>Unavailable</body></html>',200,false,'UNKNOWN']
  ] as const){
   globalThis.fetch=(async()=>new Response(body,{status,headers:{'content-type':'application/xml'}})) as typeof fetch;
   const result=await new OfficialNoticeCollector().fetchRawPage({pbltnYmd:'20261010'});
   assert.equal(result.success,expected); assert.equal(result.resultCode,code);assert.equal(result.items.length,0);
  }
 } finally {globalThis.fetch=originalFetch;if(previous===undefined)delete process.env.DATA_GO_KR_API_KEY;else process.env.DATA_GO_KR_API_KEY=previous;}
});

test('새올 readiness는 설정과 실제 최근 확인 결과를 구분',async()=>{
 const {evaluateProductionReadiness}=await import('../storage/readinessService');
 const oldKey=process.env.DATA_GO_KR_API_KEY, oldEnabled=process.env.ENABLE_OFFICIAL_API;
 const fs:any={checkReady:async()=>({ready:true,available:true,error:null})};
 const notifier:any={isConfigured:()=>false};
 try{
  process.env.DATA_GO_KR_API_KEY='fixture';delete process.env.ENABLE_OFFICIAL_API;
  assert.equal((await evaluateProductionReadiness(fs,notifier)).officialApiStatus,'configured / upstream not yet verified');
  for(const success of [true,false]){
   const collector:any={getLastCheck:()=>({success,httpStatus:success?200:403,resultCode:success?'03':'30',checkedAt:'2026-10-11T03:00:00Z'})};
   const r=await evaluateProductionReadiness(fs,notifier,collector);
   assert.equal(r.officialApiStatus,success?'active':'failed');assert.equal(JSON.stringify(r).includes('fixture'),false);
  }
  process.env.ENABLE_OFFICIAL_API='false';assert.equal((await evaluateProductionReadiness(fs,notifier)).officialApiStatus,'disabled');
  delete process.env.ENABLE_OFFICIAL_API;process.env.DATA_GO_KR_API_KEY='  ';assert.equal((await evaluateProductionReadiness(fs,notifier)).officialApiStatus,'unavailable');
 }finally{
  if(oldKey===undefined)delete process.env.DATA_GO_KR_API_KEY;else process.env.DATA_GO_KR_API_KEY=oldKey;
  if(oldEnabled===undefined)delete process.env.ENABLE_OFFICIAL_API;else process.env.ENABLE_OFFICIAL_API=oldEnabled;
 }
});


test('새올 실제 필드 ttlNm·mngNo를 읽고 우동3 변경 고시를 보존·중복 제거',()=>{
 const c=new OfficialNoticeCollector();
 const udong=REDEVELOPMENT_SEED_PROJECTS.find(p=>p.id==='udong-3')!;
 const notice={ttlNm:'우동3 재개발사업 정비계획 및 정비구역 변경 지정 고시',mngNo:'2026-366',pbltnYmd:'20261007',tkcgDeptNm:'도시정비과',seNm:'고시'};
 const items=c.filterNoticesForProject([notice,notice],udong);
 assert.equal(items.length,1);assert.equal(items[0].title,notice.ttlNm);
 assert.equal(items[0].noticeNumber,'2026-366');assert.equal(items[0].projectId,'udong-3');
 assert.equal(items[0].publishedAt,'2026-10-07T00:00:00+09:00');
 assert.equal(c.filterNoticesForProject([notice],project).length,0);
 assert.notEqual(c.filterNoticesForProject([{...notice,mngNo:'2026-367'}],udong)[0].id,items[0].id);
});
test('새올 최근7일 재조회 및 명시 과거 날짜 조회',async()=>{
 const c=new OfficialNoticeCollector(); const dates:string[]=[];
 c.fetchAllNoticesForDate=async(date)=>{dates.push(date);return {success:true,httpStatus:200,resultCode:'00',totalCount:0,items:[],rawFieldNames:[]};};
 await c.fetchForProject(project);
 assert.deepEqual(dates,Array.from({length:7},(_,i)=>getKstDateString(-i)));
 dates.length=0;await c.fetchForProject(project,{targetDates:['20261007']});
 assert.deepEqual(dates,['20261007']);
});

test('미리보기는 운영 조회만 허용하고 수집·저장 요청은 차단',async()=>{
 const {createPreviewReadOnlyMiddleware}=await import('../storage/readinessService');
 const originalFetch=globalThis.fetch;let calls=0;
 const res:any={code:0,data:null,setHeader(){},status(n:number){this.code=n;return this;},json(v:any){this.data=v;return this;}};
 try{
  globalThis.fetch=(async(target:any,options:any)=>{calls++;assert.equal(new URL(String(target)).origin,'https://k-busan.ai.studio');assert.equal(options.headers.Authorization,undefined);return new Response(JSON.stringify({documents:[{id:'actual'}]}),{headers:{'content-type':'application/json'}});}) as typeof fetch;
  const middleware=createPreviewReadOnlyMiddleware(true);
  for(const [method,path] of [['POST','/jobs/poll'],['POST','/developments/seed'],['GET','/official/saeol-probe'],['GET','/poll'],['GET','/unknown']]){
   await middleware({method,path,originalUrl:'/api'+path} as any,res,()=>assert.fail('preview bypass'));assert.equal(res.code,403);
  }
  assert.equal(calls,0);
  await middleware({method:'GET',path:'/storage/overview',originalUrl:'/api/storage/overview'} as any,res,()=>assert.fail('local DB accessed'));
  assert.equal(res.code,200);assert.equal(res.data.documents[0].id,'actual');assert.equal(calls,1);
  let next=false;await createPreviewReadOnlyMiddleware(false)({method:'POST',path:'/jobs/poll'} as any,res,()=>{next=true;});assert.equal(next,true);assert.equal(calls,1);
  globalThis.fetch=(async()=>{throw new Error('unavailable');}) as typeof fetch;
  await middleware({method:'GET',path:'/storage/overview',originalUrl:'/api/storage/overview'} as any,res,()=>assert.fail());assert.equal(res.code,502);
 }finally{globalThis.fetch=originalFetch;}
});

// Synthetic contract fixtures; public notice metadata verified independently.
const cityTitle='우동3 재개발사업 정비계획 및 정비구역 변경 지정 고시';
const cityUrl='https://www.busan.go.kr/nbgosi/view?gosiGbn=N&sno=79798';
const cityList=`<table><tr><td>2026-366</td><td><a href="${cityUrl.replaceAll('&','&amp;')}">${cityTitle}</a></td><td>도시정비과</td><td>2026.10.07</td></tr></table>`;
const cityDetail=`<html><body><h4>${cityTitle}</h4><dl><dt>고시공고번호</dt><dd>2026-366</dd><dt>공고일자</dt><dd>2026.10.07</dd></dl><div>내용 우동3 재개발사업 정비계획 및 정비구역 변경 지정하고 지형도면을 고시합니다.</div><a href="/download/file.hwpx">첨부파일</a></body></html>`;
test('부산시 고시 웹 수집: 실제 제목·날짜·번호·원문·첨부, API키 없이 회복',async()=>{
 const {BusanCityNoticeCollector}=await import('../collector/officialCollector');
 const udong=REDEVELOPMENT_SEED_PROJECTS.find(p=>p.id==='udong-3')!;
 const fetcher=(async(u:any)=>new Response(String(u).includes('/view?')?cityDetail:String(u)==='https://www.busan.go.kr/nbgosi'?cityList:'<table><tr><td>등록된 자료가 없습니다</td></tr></table>')) as typeof fetch;
 const r=await new BusanCityNoticeCollector(fetcher,()=>new Date('2026-10-12T15:00:00Z')).fetchForProjects([udong]);
 assert.equal(r.error,undefined);assert.equal(r.items.length,1);assert.equal(r.items[0].title,cityTitle);assert.equal(r.items[0].noticeNumber,'2026-366');assert.equal(r.items[0].actorType,'official');assert.equal(r.items[0].detailVerified,true);assert.equal(r.items[0].attachmentUrls?.length,1);
 const expired=await new BusanCityNoticeCollector(fetcher,()=>new Date('2026-10-22T15:00:00Z')).fetchForProjects([udong]);assert.equal(expired.items.length,0);
});
test('부산시 웹 502·파싱실패를 성공0건으로 처리하지 않음',async()=>{
 const {BusanCityNoticeCollector,parseCityNoticeList,canonicalCityNoticeUrl}=await import('../collector/officialCollector');
 assert.throws(()=>parseCityNoticeList('<html>로그인</html>'));
 assert.throws(()=>canonicalCityNoticeUrl('https://evil.example/nbgosi/view?sno=79798'));
 const r=await new BusanCityNoticeCollector((async()=>new Response('',{status:502})) as typeof fetch).fetchForProjects([project]);
 assert.equal(r.items.length,0);assert.ok(r.error?.includes('502'));
});


test('부산시 웹·새올 동일 고시는 저장·AI 판별 전에 한 건으로 합침',async()=>{
 const oldKey=process.env.DATA_GO_KR_API_KEY;
 try{
  process.env.DATA_GO_KR_API_KEY='fixture';
  const udong=REDEVELOPMENT_SEED_PROJECTS.find(p=>p.id==='udong-3')!;
  const item:RawCollectedItem={...raw,actorType:'official',projectId:udong.id,title:cityTitle,content:cityTitle,sourceUrl:cityUrl,noticeNumber:'2026-366',matchedKeywords:['우동3'],publishedAt:'2026-10-07T00:00:00+09:00'};
  const p:any=new CollectionPipeline();
  p.cityBoardCollector={fetchForProjects:async()=>({items:[item]})};
  p.newsCollector={fetchForProject:async()=>({items:[]})};
  p.officialCollector={fetchForProject:async()=>({items:[{...item,id:'api-copy',sourceUrl:'https://apis.data.go.kr/notice'}],sourceName:'새올'})};
  p.geminiAnalyzer=new GeminiAnalyzer({dryRunMode:true});
  const result=await p.run({projects:[udong]});
  assert.equal(result.rawItems.length,1);assert.equal(result.rawItems[0].sourceUrl,cityUrl);
 }finally{if(oldKey===undefined)delete process.env.DATA_GO_KR_API_KEY;else process.env.DATA_GO_KR_API_KEY=oldKey;}
});

function procurementFixture(scope:string, url:string, date='2026-10-12', noticeNumber?:string) {
 const item:RawCollectedItem={...raw,actorType:undefined,sourceType:'news-rss',sourceTier:'news',sourceName:'한국주택경제신문',title:`촉진3구역 협력업체(${scope}) 선정 입찰공고`,sourceUrl:url,publishedAt:date+'T00:00:00+09:00',noticeNumber};
 const payload:any={projectId:project.id,eventType:'협력업체/용역 입찰공고',eventDate:date,category:'입찰',title:'촉진3구역 협력업체 선정 입찰공고',summary:'입찰공고',importance:3,confidence:0.95,sourceUrl:url,sourceTier:'news',reasoningSummary:'입찰',clusterKey:'generic'};
 return {rawItem:item,payload};
}
test('동일 날짜·사건 유형의 건설사업관리와 부지정지 입찰은 별도 이벤트',()=>{
 const d=new EventDeduplicator();
 const r=d.deduplicateAndMerge([procurementFixture('기반시설공사 건설사업관리','https://example.com/cm'),procurementFixture('부지정지공사 용역','https://example.com/land')]);
 assert.equal(r.events.length,2);assert.notEqual(r.events[0].id,r.events[1].id);
});
test('동일 입찰 대상·같은 날짜의 재보도는 병합, 기존 발송 이력 유지',()=>{
 const d=new EventDeduplicator();const first=procurementFixture('부지정지공사 용역','https://example.com/a');
 const second=procurementFixture('부지정지공사','https://example.com/b');
 const r=d.deduplicateAndMerge([first,second]);assert.equal(r.events.length,1);assert.equal(r.events[0].sources.length,2);
 r.events[0].alreadyDispatched=true;
 const again=d.deduplicateAndMerge([second],r.events);assert.equal(again.events.length,1);assert.equal(again.events[0].id,r.events[0].id);assert.equal(again.events[0].alreadyDispatched,true);
});
test('다른 날짜·다른 공고번호·불명확한 입찰 대상은 임의 병합 금지',()=>{
 const d=new EventDeduplicator();
 for(const pair of [
  [procurementFixture('부지정지공사','https://example.com/a','2026-10-12'),procurementFixture('부지정지공사','https://example.com/b','2026-10-13')],
  [procurementFixture('부지정지공사','https://example.com/a','2026-10-12','1'),procurementFixture('부지정지공사','https://example.com/b','2026-10-12','2')],
  [procurementFixture('대상 미확인','https://example.com/a'),procurementFixture('대상 미확인','https://example.com/b')]
 ]) assert.equal(d.deduplicateAndMerge(pair).events.length,2);
 assert.notEqual(d.generateClusterSignature(project.id,'관리처분계획 변경 인가','2026-10-12'),d.generateClusterSignature(project.id,'관리처분계획 변경 취소','2026-10-12'));
});

test('부산시 목록 기본주소 사용·실제 다음 페이지 링크 추적',async()=>{
 const {BusanCityNoticeCollector}=await import('../collector/officialCollector');const calls:string[]=[];
 const fetcher=(async(u:any)=>{const url=String(u);calls.push(url);return new Response(url.includes('/view?')?cityDetail:url=== 'https://www.busan.go.kr/nbgosi'?cityList+'<a href="/nbgosi?curPage=2&amp;gosiGbn=N">2</a>':'<table><tr><td>등록된 자료가 없습니다</td></tr></table>');}) as typeof fetch;
 const r=await new BusanCityNoticeCollector(fetcher,()=>new Date('2026-10-13T00:00:00Z')).fetchForProjects([project]);
 assert.equal(calls[0],'https://www.busan.go.kr/nbgosi');assert.ok(calls.includes('https://www.busan.go.kr/nbgosi?curPage=2&gosiGbn=N'));assert.equal(r.error,undefined);
});
test('부산시 일시적 연결 실패 1회 재시도와 오류 원인 코드 보존',async()=>{
 const {readCityNoticeHtml}=await import('../collector/officialCollector');let calls=0;
 const error=new TypeError('fetch failed',{cause:{code:'ECONNRESET'}});
 const fetcher=(async()=>{if(++calls===1)throw error;return new Response('<html>ok</html>');}) as typeof fetch;
 assert.equal(await readCityNoticeHtml(fetcher,'https://www.busan.go.kr/nbgosi'),'<html>ok</html>');assert.equal(calls,2);
 calls=0;await assert.rejects(readCityNoticeHtml((async()=>{calls++;throw error;}) as typeof fetch,'https://www.busan.go.kr/nbgosi'),/ECONNRESET/);assert.equal(calls,2);
});
test('부산시 레거시 리다이렉트 HTTPS 유지·외부 리다이렉트 차단',async()=>{
 const {readCityNoticeHtml}=await import('../collector/officialCollector');const calls:string[]=[];
 const fetcher=(async(u:any)=>{calls.push(String(u));return calls.length===1?new Response(null,{status:302,headers:{location:'http://www.busan.go.kr/nbgosi?gosiGbn=N'}}):new Response('<html>ok</html>');}) as typeof fetch;
 await readCityNoticeHtml(fetcher,'https://www.busan.go.kr/nbgosi');assert.equal(calls[1],'https://www.busan.go.kr/nbgosi?gosiGbn=N');
 await assert.rejects(readCityNoticeHtml((async()=>new Response(null,{status:302,headers:{location:'https://evil.example/'}})) as typeof fetch,'https://www.busan.go.kr/nbgosi'),/CITY_REDIRECT_REJECTED/);
});


test('AI 관련성·추출 1회 호출 및 재시작 후 캐시 재사용', async () => {
  const cache = new Map<string, any>(); let calls=0;
  const answer={status:'relevant',relatednessConfidence:.95,explanation:'실제 입찰 공고',
    projectId:project.id,eventType:'협력업체/용역 입찰공고',category:'사업단계',title,summary:'용역 입찰',
    importance:3,confidence:.9,eventDate:'2026-10-08',clusterKey:'vendor',reasoningSummary:'일반 용역'};
  const setup=()=>{
    const a=new GeminiAnalyzer({dryRunMode:true});
    (a as any).ai={models:{generateContent:async (request:any)=>{
      calls++;assert.equal(request.config.maxOutputTokens,4096);
      assert.equal(request.config.thinkingConfig.thinkingLevel,'LOW');
      assert.ok(request.config.responseSchema.required.includes('eventType'));
      return {text:JSON.stringify(answer),usageMetadata:{promptTokenCount:100,candidatesTokenCount:50,thoughtsTokenCount:20,totalTokenCount:170}};
    }}};
    a.beginRun({get:async k=>cache.get(k)||null,set:async(k,v)=>{cache.set(k,structuredClone(v));}});return a;
  };
  const a=setup(); await Promise.all([a.validateRelatedness(raw,project),a.validateRelatedness(raw,project)]);
  assert.equal((await a.extractEvent(raw,project)).importance,3);assert.equal(calls,1);
  assert.equal(a.usage.totalTokens,170);
  const b=setup();await b.validateRelatedness(raw,project);await b.extractEvent(raw,project);
  assert.equal(calls,1);assert.equal(b.usage.cacheHits,1);assert.equal(b.usage.requests,0);
  await b.validateRelatedness({...raw,content:raw.content+'수정'},project);assert.equal(calls,2);
});

test('AI 무관한 자료도 캐시하고 이벤트 추출하지 않음',async()=>{
 const a=new GeminiAnalyzer({dryRunMode:true});const cache=new Map<string,any>();let calls=0;
 (a as any).ai={models:{generateContent:async()=>{calls++;return {text:JSON.stringify({status:'irrelevant',relatednessConfidence:.99,explanation:'対象外'})};}}};
 const storage={get:async(k:string)=>cache.get(k)||null,set:async(k:string,v:any)=>{cache.set(k,v);}};
 a.beginRun(storage);assert.equal((await a.validateRelatedness(raw,project)).status,'irrelevant');
 await assert.rejects(()=>a.extractEvent(raw,project),/NOT_RELEVANT/);
 a.beginRun(storage);await a.validateRelatedness(raw,project);assert.equal(calls,1);
});

test('AI 응답 잘림·잘못된 JSON·통신 실패는 영구 캐시하지 않음',async()=>{
 for(const response of [{text:'{}'}, {text:'broken'}, {text:'{}',candidates:[{finishReason:'MAX_TOKENS'}]},null]){
  const a=new GeminiAnalyzer({dryRunMode:true});let writes=0;
  (a as any).ai={models:{generateContent:async()=>{if(!response)throw Error('network');return response;}}};
  a.beginRun({get:async()=>null,set:async()=>{writes++;}});
  assert.equal((await a.validateRelatedness(raw,project)).status,'uncertain');
  await assert.rejects(()=>a.extractEvent(raw,project),/NOT_RELEVANT/);
  assert.equal(Object.values(a.usage.failureReasons).reduce((n,v)=>n+v,0),1);
  assert.equal(writes,0);assert.equal(a.usage.requests,1);assert.equal(a.usage.failures,1);
 }
});

test('전체 본문·원문 확인·구역 설정 변경 시 캐시 무효화',()=>{
 const key=analysisCacheKey(raw,project);
 assert.notEqual(key,analysisCacheKey({...raw,content:raw.content+'x'},project));
 assert.notEqual(key,analysisCacheKey({...raw,detailVerified:false},project));
 assert.notEqual(key,analysisCacheKey(raw,{...project,aliases:[...project.aliases,'새별칭']}));
 assert.equal(key,analysisCacheKey({...raw,collectedAt:'2026-10-14'},project));
});

test('AI 입력 상한·앞뒤 보존·스크립트 제거, 원문 유지',()=>{
 const original='<script>secretScript()</script>'+ 'a'.repeat(15000)+'끝부분 금액100억';
 const compact=compactAnalysisContent(original);
 assert.ok(compact.length<=12000);assert.ok(!compact.includes('secretScript'));
 assert.ok(compact.endsWith('끝부분 금액100억'));assert.ok(compact.includes('中間')||compact.includes('중간 생략'));
 assert.ok(original.includes('secretScript'));
});


test('AI 동시 작업 상한과 결과 순서 보존',async()=>{
 let active=0,peak=0;
 const values=await mapWithConcurrency(Array.from({length:15},(_,i)=>i),4,async i=>{
  active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,2));active--;return i*2;
 });
 assert.equal(peak,4);assert.deepEqual(values,Array.from({length:15},(_,i)=>i*2));
});

test('AI 429와 불완전 사건 응답은 사유 기록하고 발송 후보를 만들지 않음',async()=>{
 for (const failure of ['rate','event']) {
  const a=new GeminiAnalyzer({dryRunMode:true});
  (a as any).ai={models:{generateContent:async()=>{
   if(failure==='rate')throw Object.assign(Error('redacted'),{status:429});
   return {text:JSON.stringify({status:'relevant',relatednessConfidence:.9,explanation:'관련'})};
  }}};
  a.beginRun();const v=await a.validateRelatedness(raw,project);
  assert.equal(v.status,'uncertain');assert.equal(v.confidence,0);
  assert.equal(a.usage.failureReasons[failure==='rate'?'AI_RATE_LIMIT':'AI_EVENT_INVALID'],1);
 }
});


test('조합 게시판 연결 재시도 1회·세부 원인 보존',async()=>{
 let calls=0;const failure=()=>Object.assign(new TypeError('fetch failed'),{cause:{code:'ECONNRESET'}});
 assert.equal(await readAssociationHtml((async()=>{if(++calls===1)throw failure();return new Response('<html>ok</html>');}) as typeof fetch,url),' <html>ok</html>'.trim());
 assert.equal(calls,2);calls=0;
 await assert.rejects(()=>readAssociationHtml((async()=>{calls++;throw failure();}) as typeof fetch,url),/ECONNRESET/);assert.equal(calls,2);
});

test('조합 게시판 공식호스트 HTTPS 리다이렉트 및 외부호스트 차단',async()=>{
 const visited:string[]=[];
 await readAssociationHtml((async(u:any)=>{visited.push(String(u));return visited.length===1?new Response(null,{status:302,headers:{location:'http://dynamice.busan.go.kr/view.do?no=287'}}):new Response('<html>ok</html>');}) as typeof fetch,url);
 assert.ok(visited.every(u=>u.startsWith('https://dynamice.busan.go.kr/')));
 await assert.rejects(()=>readAssociationHtml((async()=>new Response(null,{status:302,headers:{location:'https://example.com/view.do'}})) as typeof fetch,url),/REDIRECT_REJECTED/);
});

test('조합 게시판 인증서 오류는 재시도·검증 우회 없이 실패',async()=>{
 let calls=0;
 await assert.rejects(()=>readAssociationHtml((async()=>{calls++;throw Object.assign(Error('TLS connection'),{cause:{code:'UNABLE_TO_VERIFY_LEAF_SIGNATURE'}});}) as typeof fetch,url),/UNABLE_TO_VERIFY_LEAF_SIGNATURE/);
 assert.equal(calls,1);
});

test('실제 카드 구조: 구역번호 식별·제목 분리·GET 페이지 이동', () => {
 const html = `<form id="boardFrm"><input name="pageIndex" value="1"><input name="pgMode" value="list"></form><ul class="board-list-ul"><li><a href="#" onclick="javascript:move_view('20680', 'BBSMSTR_000000000080', 'BARA_0000000000151')"><h3 class="b-tit">협력업체 선정 입찰 공고<span>N</span></h3><div class="left-box">등록일 : 2026-10-08 등록자 : 작성자</div></a></li><li><a href="#" onclick="javascript:move_view('20679', 'BBSMSTR_000000000080', 'BARA_0000000030153')"><h3 class="b-tit">촉진3 유사 제목</h3><div class="left-box">등록일 : 2026-10-07</div></a></li></ul><div class="board-paging"><a onclick="linkPage(2)">2</a></div>`;
 const r = parseAssociationList(html);
 assert.equal(r.entries.length,1);assert.equal(r.entries[0].title,'협력업체 선정 입찰 공고');
 assert.equal(new URL(r.entries[0].url).searchParams.get('ntt_id'),'20680');
 assert.equal(new URL(r.nextUrl!).searchParams.get('pageIndex'),'2');
 assert.equal(r.oldestPublishedAt,'2026-10-07T00:00:00+09:00');
 assert.throws(()=>parseAssociationList(html.replace('2026-10-08','날짜 없음')));
});
