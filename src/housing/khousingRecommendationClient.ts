import {tradeHistoryOrigin} from './apartmentTradeHistory';
import type {AptProjectionMode} from './apartmentCanonicalReader';
const fail=():never=>{throw Error('KHOUSING_RECOMMENDATION_UNAVAILABLE');};
const pos=(x:unknown)=>Number.isSafeInteger(x)&&Number(x)>0;
export function createKhousingRecommendationMode(preview?:Readonly<{origin:string;revision:string}>,request:typeof fetch=fetch,now=Date.now):AptProjectionMode {
 if(preview&&(!/^https:\/\/[a-z][a-z0-9-]{0,15}---k-housing-5he2zcaska-du\.a\.run\.app$/.test(preview.origin)||
   !/^r\d{14}(?:_[a-f0-9]{8})?$/.test(preview.revision))) fail();
 return {kind:'canonical',async project(months){
   const url=new URL('/api/apt/recommendation-sales/v1',preview?.origin??tradeHistoryOrigin);
   const res=await request(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(12_000),redirect:'error'});
   if(!res.ok||!res.body||!res.headers.get('content-type')?.startsWith('application/json')) return fail();
   const stream=res.body.getReader(), decoder=new TextDecoder('utf-8',{fatal:true}); let size=0,body='';
   try {
     for(;;){const p=await stream.read();if(p.done) break; size+=p.value.byteLength;if(size>512_000){await stream.cancel();return fail();}
       body+=decoder.decode(p.value,{stream:true});}
     body+=decoder.decode();
   }finally{stream.releaseLock();}
   const p=JSON.parse(body),at=now(),checked=Date.parse(p?.checkedAt),observed=Date.parse(p?.observedAt);
   if(p?.schema!==1||p.readMode!==(preview?'pinned':'active')||(preview&&p.revision!==preview.revision)||
      typeof p.revision!=='string'||!/^r\d{14}(?:_[a-f0-9]{8})?$/.test(p.revision)||
      !Array.isArray(p.months)||p.months.length!==months.length||!months.every((m,i)=>m===p.months[i])||
      !Number.isFinite(checked)||checked>at+300_000||!Number.isFinite(observed)||observed>checked+300_000||
      !Number.isFinite(p.validUntil)||p.validUntil<=at||p.validUntil!==observed+108_000_000||
      !Array.isArray(p.results)||p.results.length>1000) return fail();
   const unique=new Set<string>();
   for(const r of p.results){
     if(!r||![r.complexId,r.name,r.region,r.neighborhood,r.areaCategory].every(x=>typeof x==='string'&&x.length>0&&x.length<130)||
       !/^\d{5}$/.test(r.region)||!pos(r.price)||!Number.isSafeInteger(r.floor)||!Number.isFinite(r.area)||r.area<=0||
       !/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date))||new Date(r.date).toISOString().slice(0,10)!==r.date||
       !months.includes(r.date.slice(0,7).replace('-',''))||!r.tradeSummary||
       ![r.tradeSummary.count,r.tradeSummary.min,r.tradeSummary.max].every(pos)||
       r.tradeSummary.min>r.price||r.tradeSummary.max<r.price) return fail();
     const key=JSON.stringify([r.complexId,r.areaCategory]);if(unique.has(key))return fail();unique.add(key);
   }
   return {results:p.results,revision:p.revision,checkedAt:p.checkedAt,observedAt:p.observedAt,validUntil:p.validUntil,incomplete:false};
 }};
}
