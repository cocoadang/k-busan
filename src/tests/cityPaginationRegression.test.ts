import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BusanCityNoticeCollector} from '../collector/officialCollector';
const capture=JSON.parse(readFileSync(new URL('./fixtures/city-pagination.json',import.meta.url),'utf8'));
const detail=readFileSync(new URL('./fixtures/city-recovery.html',import.meta.url),'utf8');
const clock=()=>new Date(capture.at);
const pageHtml=(row:any)=>'<table>'+row.ids.map((id:string,i:number)=>`<tr><td>2026-1</td><td><a href="/nbgosi/view?sno=${id}&gosiGbn=N">ordinary notice</a></td><td>${row.dates[i].slice(0,10)}</td></tr>`).join('')+'</table>'+`<a href="${row.next}">next</a>`;
test('captured 17-page date boundary completes within finite request budget',async()=>{
 const calls:string[]=[];
 const fetcher=(async(u:any)=>{calls.push(String(u));const url=new URL(String(u));return new Response(url.pathname.endsWith('/view')?detail:pageHtml(capture.rows[Number(url.searchParams.get('curPage')||1)-1]));}) as typeof fetch;
 const result=await new BusanCityNoticeCollector(fetcher,clock).fetchForProjects([]);
 assert.equal(result.error,undefined);assert.equal(calls.length,18);
 const old=await new BusanCityNoticeCollector(fetcher,clock).fetchForProjects([],{maxPages:10});
 assert.match(old.error!,/CITY_BOARD_PAGE_LIMIT/);
});
test('request cap covers lists and recovery; incomplete is retained',async()=>{
 let count=0;const fetcher=(async()=>{count++;return new Response(pageHtml(capture.rows[count-1]));}) as typeof fetch;
 const result=await new BusanCityNoticeCollector(fetcher,clock).fetchForProjects([],{maxRequests:2});
 assert.equal(count,2);assert.match(result.error!,/CITY_REQUEST_LIMIT/);
});
test('403 and 429 stop all later reads including recovery',async()=>{
 for(const status of [403,429]){let count=0;
 const result=await new BusanCityNoticeCollector((async()=>{count++;return new Response('',{status});}) as typeof fetch,clock).fetchForProjects([]);
 assert.equal(count,1);assert.match(result.error!,new RegExp(`CITY_HTTP_${status}`));}
});
test('duplicate page cannot claim full coverage',async()=>{
 const result=await new BusanCityNoticeCollector((async(u:any)=>new Response(String(u).includes('/view')?detail:pageHtml(capture.rows[0]))) as typeof fetch,clock).fetchForProjects([]);
 assert.match(result.error!,/CITY_DUPLICATE_PAGE/);
});
test('date order anomaly fails closed before accepting an old page boundary',async()=>{
 const row={...capture.rows[0],dates:[...capture.rows[0].dates]};row.dates[0]='2026-10-01T00:00:00+09:00';
 const result=await new BusanCityNoticeCollector((async(u:any)=>new Response(String(u).includes('/view')?detail:pageHtml(row))) as typeof fetch,clock).fetchForProjects([]);
 assert.match(result.error!,/CITY_DATE_ORDER_UNVERIFIED/);
});
test('overall budget aborts body wait and prevents recovery or retry requests',async()=>{
 let count=0;const keepAlive=setTimeout(()=>{},500);
 try{const result=await new BusanCityNoticeCollector((async(_u:any,init:any)=>{count++;return {ok:true,status:200,text:()=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason)))};}) as typeof fetch,clock).fetchForProjects([],{budgetMs:20});
 assert.equal(count,1);assert.match(result.error!,/CITY_BUDGET_EXHAUSTED/);
 }finally{clearTimeout(keepAlive);}
});
