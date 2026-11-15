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

test('injected city transport uses its longer spacing while all hosts share one queue',async()=>{
 const times:number[]=[];const paced=createOfficialRequestGovernor({intervalMs:0,cooldownMs:0,intervalForHost:h=>h==='www.busan.go.kr'?20:0,fetcher:(async()=>{times.push(Date.now());return new Response('ok')}) as typeof fetch});await paced('https://apis.data.go.kr/test');await paced('https://www.busan.go.kr/nbgosi');assert.ok(times[1]-times[0]>=18);
});
test('fresh city connections retain TLS verification, abort signal and manual redirects',async()=>{
 const {createFreshCityFetch}=await import('../collector/freshCityFetch');const {EventEmitter}=await import('node:events');const{PassThrough}=await import('node:stream');let calls=0;const controller=new AbortController();
 const requester=((url:any,opts:any,cb:any)=>{calls++;assert.equal(opts.agent,false);assert.equal(opts.rejectUnauthorized,true);assert.equal(opts.minVersion,'TLSv1.2');assert.equal(opts.maxVersion,'TLSv1.2');assert.equal(opts.signal,controller.signal);assert.equal(url.hostname,'www.busan.go.kr');const req:any=new EventEmitter();req.end=()=>{const response:any=new PassThrough();response.statusCode=302;response.headers={location:'/nbgosi?next=1'};cb(response);response.end();};return req;}) as any;
 const reader=createFreshCityFetch(requester);const r=await reader('https://www.busan.go.kr/nbgosi',{signal:controller.signal});assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/nbgosi?next=1');assert.equal(calls,1);await assert.rejects(reader('https://example.com/nbgosi'),/URL_REJECTED/);assert.equal(calls,1);
});

test('city TLS failure preserves its phase and transport code without logging URLs',async()=>{
 const{createFreshCityFetch}=await import('../collector/freshCityFetch');const{EventEmitter}=await import('node:events');
 const requester=((_url:any,_opts:any,_cb:any)=>{const req:any=new EventEmitter();req.end=()=>{const socket:any=new EventEmitter();req.emit('socket',socket);socket.emit('connect');req.emit('error',Object.assign(Error('read ECONNRESET'),{code:'ECONNRESET'}));};return req;}) as any;
 await assert.rejects(createFreshCityFetch(requester)('https://www.busan.go.kr/nbgosi'),(e:any)=>e.cause.code==='ECONNRESET'&&e.cause.phase==='tls'&&/phase=tls/.test(e.message)&&!e.message.includes('https://'));
});
test('city incomplete response cannot be returned as valid HTML',async()=>{
 const{createFreshCityFetch}=await import('../collector/freshCityFetch');const{EventEmitter}=await import('node:events');const{PassThrough}=await import('node:stream');
 const requester=((_url:any,_opts:any,cb:any)=>{const req:any=new EventEmitter();req.end=()=>{const r:any=new PassThrough();r.statusCode=200;r.headers={};r.complete=false;cb(r);r.end('<html>truncated');};return req;}) as any;
 await assert.rejects(createFreshCityFetch(requester)('https://www.busan.go.kr/nbgosi'),(e:any)=>e.cause.phase==='body'&&e.cause.code==='CITY_INCOMPLETE_BODY');
});
