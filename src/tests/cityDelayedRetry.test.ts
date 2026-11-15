import test from 'node:test';import assert from 'node:assert/strict';
import {BusanCityNoticeCollector,readCityNoticeHtml}from'../collector/officialCollector';
import{createOfficialRequestGovernor}from'../collector/officialRequestGovernor';
const empty='<table><tr><td>등록된 자료가 없습니다</td></tr></table>';
const clock=()=>new Date('2026-11-15T00:00:00Z');
const reset=()=>new TypeError('fetch failed',{cause:{code:'ECONNRESET'}});
test('city delayed retry waits beyond the governor cooldown and makes exactly one recovery request',async()=>{
 let calls=0;const times:number[]=[];const governed=createOfficialRequestGovernor({intervalMs:0,cooldownMs:20,fetcher:(async()=>{times.push(Date.now());if(++calls===1)throw reset();return new Response(empty)}) as typeof fetch});
 const result=await new BusanCityNoticeCollector(governed,clock,0,35).fetchForProjects([]);assert.equal(result.error,undefined);assert.equal(calls,2);assert.ok(times[1]-times[0]>=30);
});
test('city transport retry budget is shared across all list pages',async()=>{
 let calls=0;const html='<table><tr><td>2026-1</td><td><a href="/nbgosi/view?sno=999&gosiGbn=N">ordinary</a></td><td>2026-11-15</td></tr></table><a href="/nbgosi?curPage=2">2</a>';
 const governed=createOfficialRequestGovernor({intervalMs:0,cooldownMs:15,fetcher:(async()=>{calls++;if(calls===1||calls===3)throw reset();return new Response(html)}) as typeof fetch});
 const result=await new BusanCityNoticeCollector(governed,clock,0,25).fetchForProjects([]);assert.ok(result.error);assert.equal(calls,3);
});
test('city quiet wait is aborted without another network request',async()=>{
 let calls=0;const controller=new AbortController();const pending=readCityNoticeHtml((async()=>{calls++;throw reset()}) as typeof fetch,'https://www.busan.go.kr/nbgosi',1000,{retryDelayMs:100,signal:controller.signal});setTimeout(()=>controller.abort(),5);await assert.rejects(pending,/CITY_BUDGET_EXHAUSTED/);assert.equal(calls,1);
});
test('other collection proceeds while city waits, with city results still first in the final audit',async()=>{
 const{CollectionPipeline}=await import('../pipeline/collectionPipeline');const{REDEVELOPMENT_SEED_PROJECTS}=await import('../registry/redevelopmentRegistry');const p:any=new CollectionPipeline();let release!:(value:any)=>void,cityDone=false,newsBeforeCity=false;
 p.cityBoardCollector={fetchForProjects:()=>new Promise(r=>{release=r})};p.newsCollector={fetchForProject:async()=>{newsBeforeCity=!cityDone;cityDone=true;release({items:[]});return{items:[]}}};const watchdog=setTimeout(()=>{cityDone=true;release({items:[]})},100);
 try{const project={...REDEVELOPMENT_SEED_PROJECTS.find(p=>p.id==='udong-3')!,associationBoard:undefined};const result=await p.run({projects:[project],enableOfficialApi:false});assert.equal(newsBeforeCity,true);assert.equal(result.audit.sourceDetails[0].sourceName,'부산광역시 공식 고시공고');}finally{clearTimeout(watchdog);}
});

test('per-request native abort after timeout permits one delayed recovery',async()=>{
 let calls=0;const fetcher=(async(_input,init)=>{if(++calls===2)return new Response(empty);return new Promise((_resolve,reject)=>{init?.signal?.addEventListener('abort',()=>reject(new Error('native abort',{cause:{code:'ABORT_ERR'}})),{once:true});});})as typeof fetch;
 const keepAlive=setTimeout(()=>{},200);try{assert.equal(await readCityNoticeHtml(fetcher,'https://www.busan.go.kr/nbgosi',5,{retryDelayMs:5}),empty);assert.equal(calls,2);}finally{clearTimeout(keepAlive);}
});
