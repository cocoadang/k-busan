import test from 'node:test';import assert from 'node:assert/strict';
import {createOfficialRequestGovernor} from '../collector/officialRequestGovernor';
test('official governor serializes complete bodies and spaces subsequent requests',async()=>{
 const saved=globalThis.fetch;let active=0,peak=0;const started:number[]=[],finished:number[]=[];
 globalThis.fetch=(async()=>{started.push(Date.now());active++;peak=Math.max(peak,active);return new Response(new ReadableStream({start(controller){setTimeout(()=>{controller.enqueue(new TextEncoder().encode('ok'));active--;finished.push(Date.now());controller.close()},15)}}));}) as typeof fetch;
 try{const paced=createOfficialRequestGovernor({intervalMs:15,cooldownMs:100});await Promise.all([1,2,3].map(()=>paced('https://www.busan.go.kr/nbgosi')));assert.equal(peak,1);assert.equal(started.length,3);for(let i=1;i<3;i++)assert.ok(started[i]-finished[i-1]>=12);}finally{globalThis.fetch=saved;}
});
test('transport failure and Retry-After suppress immediate retries without bypassing restrictions',async()=>{
 const saved=globalThis.fetch;let calls=0;
 try{globalThis.fetch=(async()=>{calls++;throw new TypeError('fetch failed')}) as typeof fetch;const paced=createOfficialRequestGovernor({intervalMs:0,cooldownMs:100});await assert.rejects(paced('https://apis.data.go.kr/test'),/fetch failed/);await assert.rejects(paced('https://apis.data.go.kr/test'),/OFFICIAL_HOST_COOLDOWN/);assert.equal(calls,1);
 globalThis.fetch=(async()=>{calls++;return new Response('slow down',{status:429,headers:{'retry-after':'2'}})}) as typeof fetch;const limited=createOfficialRequestGovernor({intervalMs:0,cooldownMs:5});assert.equal((await limited('https://www.busan.go.kr/nbgosi')).status,429);await new Promise(r=>setTimeout(r,15));await assert.rejects(limited('https://www.busan.go.kr/nbgosi'),/OFFICIAL_HOST_COOLDOWN/);assert.equal(calls,2);
 }finally{globalThis.fetch=saved;}
});
test('aborted queued official request never starts a network call',async()=>{
 const saved=globalThis.fetch;let calls=0;globalThis.fetch=(async()=>{calls++;await new Promise(r=>setTimeout(r,20));return new Response('ok')}) as typeof fetch;
 try{const paced=createOfficialRequestGovernor({intervalMs:0,cooldownMs:0});const controller=new AbortController();const first=paced('https://www.busan.go.kr/nbgosi');const second=paced('https://www.busan.go.kr/nbgosi',{signal:controller.signal});controller.abort();await first;await assert.rejects(second);assert.equal(calls,1);}finally{globalThis.fetch=saved;}
});
