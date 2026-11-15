import test from 'node:test';
import assert from 'node:assert/strict';
import {OfficialNoticeCollector} from '../collector/officialCollector';
import {AssociationNoticeCollector} from '../collector/associationCollector';
import {REDEVELOPMENT_SEED_PROJECTS} from '../registry/redevelopmentRegistry';

test('seven Saeol dates use at most three concurrent calls and retain every failure/date',async()=>{
 const c=new OfficialNoticeCollector();let active=0,peak=0;const dates:string[]=[];
 c.fetchAllNoticesForDate=async(date)=>{active++;peak=Math.max(peak,active);dates.push(date);await new Promise(r=>setTimeout(r,5));active--;return {success:false,httpStatus:0,resultCode:'NETWORK_OR_TIMEOUT_ERROR',totalCount:0,items:[],rawFieldNames:[],error:'CONNECT_TIMEOUT'};};
 const targetDates=Array.from({length:7},(_,i)=>`202611${String(15-i).padStart(2,'0')}`);
 const result=await c.fetchForProject(REDEVELOPMENT_SEED_PROJECTS[0],{targetDates});
 assert.equal(peak,3);assert.deepEqual(dates,targetDates);assert.deepEqual(Object.keys(result.dateBreakdown).sort(),[...targetDates].sort());
 for(const date of targetDates)assert.ok(result.error?.includes(`[${date}]`));
 assert.equal(result.items.length,0);
});

test('association total budget aborts body/connection and prevents fresh retry requests',async()=>{
 let calls=0;const fetcher=(async(_url:any,init:any)=>{calls++;return new Promise((_resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true});});}) as typeof fetch;
 const project=REDEVELOPMENT_SEED_PROJECTS.find(p=>p.associationBoard)!;
 const keepAlive=setTimeout(()=>{},500);const start=Date.now();
 try{const r=await new AssociationNoticeCollector(fetcher).fetchForProject(project,{timeoutMs:1000,budgetMs:25});assert.ok(r.error);assert.equal(calls,1);assert.ok(Date.now()-start<400);assert.equal(r.items.length,0);}finally{clearTimeout(keepAlive);}
});


test('Saeol exhausted collection budget keeps unqueried dates explicitly failed',async()=>{
 const c=new OfficialNoticeCollector();let calls=0;
 c.fetchAllNoticesForDate=async()=>{calls++;await new Promise(r=>setTimeout(r,20));return {success:false,httpStatus:0,resultCode:'NETWORK_OR_TIMEOUT_ERROR',totalCount:0,items:[],rawFieldNames:[],error:'CONNECT_TIMEOUT'};};
 const dates=Array.from({length:7},(_,i)=>`202611${String(15-i).padStart(2,'0')}`);
 const r=await c.fetchForProject(REDEVELOPMENT_SEED_PROJECTS[0],{targetDates:dates,budgetMs:5});
 assert.equal(calls,3);assert.equal(Object.keys(r.dateBreakdown).length,7);assert.match(r.error!,/SAEOL_BUDGET_EXHAUSTED/);assert.equal(r.items.length,0);
});
