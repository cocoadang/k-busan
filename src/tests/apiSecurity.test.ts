import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApiSecurity } from '../security/apiSecurity.ts';

test('real HTTP routes block unauthenticated side effects, test endpoints and query secrets', async () => {
 const app=express(); let effects=0;
 let secret:string|undefined='test-secret';
 app.use(createApiSecurity({production:true,secret:()=>secret}));
 app.all('*',(_req,res)=>{effects++;res.json({ok:true});});
 const server=app.listen(0,'127.0.0.1'); await new Promise<void>(r=>server.once('listening',r));
 const addr=server.address() as {port:number};const base=`http://127.0.0.1:${addr.port}`;
 try {
  for(const path of ['/api/pipeline/run','/api/plan-versions','/api/unit-types','/api/plans/seed','/api/developments/seed','/api/official/diagnostics','/api/jobs/poll']) {
   assert.equal((await fetch(base+path,{method:'POST'})).status,401);
  }
  assert.equal((await fetch(base+'/api/jobs/poll?secret=test-secret')).status,401);
  assert.equal((await fetch(base+'/api/jobs/poll',{headers:{Authorization:'Bearer wrong'}})).status,401);
  assert.equal((await fetch(base+'/api/test/telegram',{headers:{Authorization:'Bearer test-secret'}})).status,404);
  assert.equal((await fetch(base+'/api/jobs/poll',{method:'OPTIONS',headers:{Authorization:'Bearer test-secret'}})).status,405);
  assert.equal((await fetch(base+'/API/TEST/TELEGRAM',{headers:{Authorization:'Bearer test-secret'}})).status,404);
  assert.equal(effects,0);
  assert.equal((await fetch(base+'/api/storage/overview')).status,200);
  assert.equal((await fetch(base+'/api/jobs/poll',{method:'POST',headers:{Authorization:'Bearer test-secret'}})).status,200);
  assert.equal((await fetch(base+'/api/jobs/poll',{headers:{'x-cron-secret':'test-secret'}})).status,200);
  secret=undefined;
  assert.equal((await fetch(base+'/api/jobs/poll')).status,503);
  assert.equal(effects,3);
 } finally {await new Promise<void>(r=>server.close(()=>r()));}
});
test('instance quotas distinguish public requests and authorized admin calls', async () => {
 const app=express(); app.use(createApiSecurity({production:true,secret:()=> 's',publicLimit:1,adminLimit:1}));
 app.all('*',(_req,res)=>res.json({ok:true}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 try {
  assert.equal((await fetch(base+'/api/status')).status,200);
  const limited=await fetch(base+'/api/status');assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');
  assert.equal((await fetch(base+'/api/jobs/poll',{headers:{Authorization:'Bearer s'}})).status,200);
  assert.equal((await fetch(base+'/api/jobs/poll',{headers:{Authorization:'Bearer s','X-Forwarded-For':'different'}})).status,429);
 } finally {await new Promise<void>(r=>server.close(()=>r()));}
});
