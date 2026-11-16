import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import DATA from '../data/busanHousingMap.json';
import { createBusanPriceReader, createBusanPriceHandler } from '../housing/busanPriceApi';
import { mapPriceLabel } from '../housing/mapDisplay';
import { createApiSecurity } from '../security/apiSecurity';

const fixed=Date.UTC(2026,10,16);
function upstream(area='84') { return {success:true,areaCategory:area,startYmd:'202111',endYmd:'202611',summaries:Object.fromEntries(DATA.apartments.map(a=>[a.id,{complexId:a.id,hasData:true,hasTargetArea:true,latestMonthlyMedianPrice:103000,latestPeriod:'202610',transactionCount:89}]))}; }
test('Busan map preserves four official apartment outlines and keeps three projects as explicitly labelled points',()=>{
 assert.equal(DATA.apartments.length,4);assert.equal(DATA.apartmentFootprints.features.length,4);
 assert.deepEqual(DATA.projects.map(p=>p.id),['chokjin-3','udong-3','samik-beach']);
 for(const p of DATA.projects){assert.equal(p.boundaryStatus,'marker-only');assert.ok(p.boundaryNote.includes('위치만'));assert.ok(p.officialMapUrl.startsWith('https://dynamice.busan.go.kr/home/'));assert.ok(p.latitude>35.13&&p.latitude<35.20&&p.longitude>129.05&&p.longitude<129.18);}
 assert.ok(DATA.projects.find(p=>p.id==='udong-3')!.positionNote.includes('근사'));
 for(const f of DATA.apartmentFootprints.features){assert.ok(DATA.apartments.some(a=>a.id===f.properties.complexId));for(const source of f.properties.sourceObjects)assert.equal(source.type,'official-parcel');}
});
test('prices coalesce concurrent requests, retain both areas and query only the fixed public upstream',async()=>{
 let calls=0;let seen:URL[]=[];
 const reader=createBusanPriceReader((async(u:any,init:any)=>{calls++;const url=new URL(u);seen.push(url);assert.equal(init.redirect,'error');return new Response(JSON.stringify(upstream(url.searchParams.get('areaCategory')!)));}) as typeof fetch,()=>fixed);
 const [a,b]=await Promise.all([reader('84'),reader('84')]);assert.deepEqual(a,b);assert.equal(calls,1);
 await reader('59');await reader('84');assert.equal(calls,2);
 assert.equal(Object.keys(a.summaries).length,4);
 for(const u of seen){assert.equal(u.origin,'https://k-housing-5he2zcaska-du.a.run.app');assert.equal(u.pathname,'/api/map-summaries');assert.equal(u.searchParams.get('endYmd'),'202611');}
});
test('missing area is never zero price, while invalid/missing upstream data fails closed and cools down',async()=>{
 const body=upstream('59');body.summaries.busan_centum_park_2.hasData=false;body.summaries.busan_centum_park_2.hasTargetArea=false;
 const reader=createBusanPriceReader((async()=>new Response(JSON.stringify(body))) as typeof fetch,()=>fixed);
 const s=(await reader('59')).summaries.busan_centum_park_2;assert.equal(s.price,null);assert.equal(s.month,null);assert.equal(mapPriceLabel(s),'미공급');
 let calls=0,clock=fixed;
 const bad=createBusanPriceReader((async()=>{calls++;return new Response(JSON.stringify({...upstream(),summaries:{}}));}) as typeof fetch,()=>clock);
 await assert.rejects(bad('84'),/PRICE_UNAVAILABLE/);await assert.rejects(bad('84'));assert.equal(calls,1);clock+=31000;await assert.rejects(bad('84'));assert.equal(calls,2);
 assert.equal(mapPriceLabel({...s,hasTargetArea:true}),'거래 자료 없음');
});
test('read-only public map route rejects unsupported area and leaves protected writes protected',async()=>{
 let calls=0;const app=express();app.use(createApiSecurity({production:true,secret:()=> 'test-secret'}));
 app.get('/api/housing/busan-prices',createBusanPriceHandler(async(area)=>{calls++;return {areaCategory:area,fetchedAt:'2026-11-16',startYmd:'202111',endYmd:'202611',summaries:{}};}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const port=(server.address() as any).port;
 const request=(path:string,method='GET')=>new Promise<{status:number,cache:any}>(resolve=>{const req=http.request({hostname:'127.0.0.1',port,path,method},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode!,cache:res.headers['cache-control']}));});req.end();});
 try {assert.equal((await request('/api/housing/busan-prices?areaCategory=125')).status,400);assert.equal(calls,0);const r=await request('/api/housing/busan-prices?areaCategory=84');assert.equal(r.status,200);assert.ok(r.cache.includes('s-maxage=300'));assert.equal((await request('/api/housing/busan-prices','POST')).status,401);assert.equal((await request('/api/jobs/poll','POST')).status,401);assert.equal(calls,1);}
 finally {await new Promise<void>(r=>server.close(()=>r()));}
});
