import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAssociationDetail,AssociationNoticeCollector} from '../collector/associationCollector';
import {OfficialNoticeCollector} from '../collector/officialCollector';
import {REDEVELOPMENT_SEED_PROJECTS} from '../registry/redevelopmentRegistry';
const url='https://dynamice.busan.go.kr/home/BARA_0000000000151/view.do?no=329&ntt_id=20680&pgMode=view';
const captured=readFileSync(new URL('./fixtures/union-detail.html',import.meta.url),'utf8');
const list=readFileSync(new URL('./fixtures/union-list.html',import.meta.url),'utf8');
test('captured public attachment-only notice preserves two PDFs without verifying unread content',()=>{
 const d=parseAssociationDetail(captured,url);assert.equal(d.detailVerified,false);assert.equal(d.content,'');assert.equal(d.attachments.length,2);
 assert.equal(new URL(d.attachments[0]).searchParams.get('atchFileId'),'cx/kwSBivSgCWAb6LQl1VsZfC66U6UI68b9jjwGleXs=');
 assert.equal(new URL(d.attachments[1]).searchParams.get('fileSn'),'2');
});
test('attachment-only collection records incomplete detail and retains original date and links',async()=>{
 const p=REDEVELOPMENT_SEED_PROJECTS.find(p=>p.id==='chokjin-3')!;
 const r=await new AssociationNoticeCollector((async(u:any)=>new Response(String(u).includes('ntt_id')?captured:list)) as typeof fetch,()=>new Date('2026-10-10T00:00:00Z')).fetchForProject(p,{maxPages:1});
 assert.equal(r.items.length,1);assert.equal(r.items[0].detailVerified,false);assert.equal(r.items[0].attachmentUrls?.length,2);assert.equal(r.items[0].publishedAt,'2026-10-08T00:00:00+09:00');assert.match(r.error!,/ATTACHMENT_CONTENT_UNVERIFIED/);
});
test('login page cannot become verified detail',()=>assert.throws(()=>parseAssociationDetail('<html>로그인이 필요합니다.</html>',url)));
test('API missing, truncated and invalid totalCount responses fail closed',async()=>{
 const saved=globalThis.fetch,key=process.env.DATA_GO_KR_API_KEY;process.env.DATA_GO_KR_API_KEY='synthetic-test-key';
 try{for(const body of [{totalCount:1,items:{}},{totalCount:51,items:{item:[{title:'one'}]}},{totalCount:-1},{totalCount:''},{totalCount:0,items:{item:[{title:'unexpected'}]}}]){
 globalThis.fetch=(async()=>Response.json({response:{header:{resultCode:'00'},body}})) as typeof fetch;
 const r=await new OfficialNoticeCollector().fetchRawPage({pbltnYmd:'20261028'});assert.equal(r.success,false,JSON.stringify(body));
 }}finally{globalThis.fetch=saved;if(key===undefined)delete process.env.DATA_GO_KR_API_KEY;else process.env.DATA_GO_KR_API_KEY=key;}
});
test('API body timeout remains active after headers arrive',async()=>{
 const saved=globalThis.fetch,key=process.env.DATA_GO_KR_API_KEY;process.env.DATA_GO_KR_API_KEY='synthetic-test-key';
 try{
 globalThis.fetch=(async(_u:any,init:any)=>({status:200,ok:true,headers:new Headers({'content-type':'application/json'}),text:()=>new Promise((_resolve,reject)=>{const keepAlive=setTimeout(()=>reject(new Error('test watchdog')),500);init.signal.addEventListener('abort',()=>{clearTimeout(keepAlive);reject(init.signal.reason);});})})) as typeof fetch;
 const started=Date.now();const r=await new OfficialNoticeCollector().fetchRawPage({pbltnYmd:'20261028',timeoutMs:25});assert.equal(r.success,false);assert.ok(Date.now()-started<400);assert.equal(r.resultCode,'NETWORK_OR_TIMEOUT_ERROR');assert.equal(r.httpStatus,200);assert.match(r.error!,/TimeoutError/);
 }finally{globalThis.fetch=saved;if(key===undefined)delete process.env.DATA_GO_KR_API_KEY;else process.env.DATA_GO_KR_API_KEY=key;}
});
