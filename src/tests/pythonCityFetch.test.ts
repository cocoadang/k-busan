import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {createPythonCityFetch} from '../collector/pythonCityFetch';
function child(result:any,pending=false){
 const c:any=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();c.stdin=new PassThrough();c.killed=0;c.input='';c.kill=()=>{c.killed++;return true};
 c.stdin.on('data',(b:Buffer)=>c.input+=b.toString());c.stdin.on('finish',()=>{if(pending)return;queueMicrotask(()=>{c.stdout.end(typeof result==='string'?result:JSON.stringify(result));c.emit('close',0)});});return c;
}
const response=(status=200)=>({status,headers:[['content-type','text/html'],['location','/nbgosi?curPage=2']],body:Buffer.from('<html>verified</html>').toString('base64')});
test('system client isolates environment and leaves redirects to the collector',async()=>{
 let calls=0;const c=child(response(302));
 const reader=createPythonCityFetch(((cmd:any,args:any,opts:any)=>{calls++;assert.equal(cmd,'python3');assert.equal(args[0],'-c');assert.ok(Object.keys(opts.env).every(k=>['PATH','LANG','PYTHONIOENCODING','NODE_EXTRA_CA_CERTS'].includes(k)));return c}) as any);
 const r=await reader('https://www.busan.go.kr/nbgosi',{headers:{Accept:'text/html'}});
 assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/nbgosi?curPage=2');assert.equal(await r.text(),'<html>verified</html>');assert.equal(calls,1);
 assert.equal(JSON.parse(c.input).url,'https://www.busan.go.kr/nbgosi');
});
test('system client preserves access failures without retry',async()=>{
 let calls=0;const reader=createPythonCityFetch((()=>{calls++;return child(response(403))}) as any);
 assert.equal((await reader('https://www.busan.go.kr/nbgosi')).status,403);assert.equal(calls,1);
});
test('system client validates destination and kills aborted processes',async()=>{
 let calls=0;const c=child(null,true),reader=createPythonCityFetch((()=>{calls++;return c}) as any);
 await assert.rejects(reader('https://example.com/nbgosi'),/URL_REJECTED/);await assert.rejects(reader('https://www.busan.go.kr:444/nbgosi'),/URL_REJECTED/);assert.equal(calls,0);
 const controller=new AbortController();const result=reader('https://www.busan.go.kr/nbgosi',{signal:controller.signal});controller.abort();await assert.rejects(result,(e:any)=>e.cause.code==='ABORT_ERR');assert.equal(c.killed,1);
});
test('system client rejects malformed, oversized and unverified responses',async()=>{
 for(const [result,code]of [['invalid-json','CITY_PYTHON_INVALID_RESPONSE'],[{error:'CERTIFICATE_VERIFY_FAILED'},'CERTIFICATE_VERIFY_FAILED'],[{...response(),body:Buffer.alloc(2*1024*1024+1).toString('base64')},'OFFICIAL_RESPONSE_LIMIT']] as const){
  const reader=createPythonCityFetch((()=>child(result)) as any);await assert.rejects(reader('https://www.busan.go.kr/nbgosi'),(e:any)=>e.cause.code===code);
 }
});
