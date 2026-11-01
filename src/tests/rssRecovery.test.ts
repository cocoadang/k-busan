import test from 'node:test';
import assert from 'node:assert/strict';
import { NewsCollector } from '../collector/newsCollector';
import { REDEVELOPMENT_SEED_PROJECTS } from '../registry/redevelopmentRegistry';
const p = REDEVELOPMENT_SEED_PROJECTS[0];
const good = () => new Response('<rss><channel><item><title>sample</title><link>https://example.com/one</link><pubDate>Wed, 28 Oct 2026 00:00:00 GMT</pubDate></item></channel></rss>', {headers:{'content-type':'application/xml'}});
async function run(responses: (() => Response)[]) {
 const original=globalThis.fetch; let calls=0; const urls:string[]=[];
 globalThis.fetch=(async(url:any)=>{urls.push(String(url));return responses[Math.min(calls++,responses.length-1)]();}) as typeof fetch;
 try { return {result:await new NewsCollector(0).fetchForProject(p),urls,get calls(){return calls;}}; }
 finally {globalThis.fetch=original;}
}
test('transient 503 recovers once on identical query, with no false error', async()=>{
 const r=await run([()=>new Response('Service unavailable',{status:503}),good,good]);
 assert.equal(r.calls,3); assert.equal(r.result.error,undefined); assert.equal(r.result.items.length,1);
 assert.equal(r.urls[0],r.urls[1]); assert.notEqual(r.urls[1],r.urls[2]);
});
test('persistent 503 remains failed and stops remaining queries',async()=>{
 const r=await run([()=>new Response('Unavailable',{status:503})]);
 assert.equal(r.calls,2); assert.equal(r.result.items.length,0); assert.equal(r.result.queryFailures?.length,1); assert.match(r.result.error!,/503/);
});
test('partial recovery retains data and the unrecovered query failure',async()=>{
 const r=await run([good,()=>new Response('Unavailable',{status:503})]);
 assert.equal(r.calls,3); assert.equal(r.result.items.length,1); assert.equal(r.result.queryFailures?.length,1); assert.match(r.result.error!,/503/);
});
for(const status of [403,429]) test(`HTTP ${status} stops remaining queries without retry`,async()=>{
 const r=await run([()=>new Response('Denied',{status})]); assert.equal(r.calls,1); assert.equal(r.result.httpStatus,status); assert.ok(r.result.error);
});
test('503 restriction page stops without retry or query changes',async()=>{
 const r=await run([()=>new Response('unusual traffic CAPTCHA',{status:503})]); assert.equal(r.calls,1); assert.ok(r.result.error);
});
test('long Retry-After is not bypassed with immediate retry',async()=>{
 const r=await run([()=>new Response('Unavailable',{status:503,headers:{'retry-after':'120'}})]); assert.equal(r.calls,1); assert.ok(r.result.error);
});
test('legitimate empty RSS succeeds without retry',async()=>{
 const r=await run([()=>new Response('<rss><channel><title>empty</title></channel></rss>',{headers:{'content-type':'application/xml'}})]); assert.equal(r.calls,2); assert.equal(r.result.error,undefined); assert.equal(r.result.items.length,0);
});
test('earlier query failure remains visible after later query succeeds',async()=>{
 const r=await run([()=>new Response('Gateway error',{status:502}),good]);
 assert.equal(r.calls,2); assert.equal(r.result.items.length,1); assert.equal(r.result.queryFailures?.[0].httpStatus,502); assert.match(r.result.error!,/502/);
});
test('retry delay shares the original timeout and cannot trigger another request',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=(async()=>{calls++;return new Response('Unavailable',{status:503});}) as typeof fetch;
 try {const r=await new NewsCollector(1000).fetchForProject(p,{timeoutMs:10});assert.ok(r.error);assert.ok(calls<=2);assert.equal(r.items.length,0);}
 finally {globalThis.fetch=original;}
});
