import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApartmentTradeHistoryHandler } from '../housing/apartmentTradeHistoryApi.ts';
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

test('Apt saved history exact GET and HEAD reach the handler; writes and other paths stay protected', async () => {
 const app=express();
 const path='/api/housing/apartment-trade-history';
 app.use(createApiSecurity({production:true,secret:()=> 'test-secret',clientLimit:2}));
 app.get(path,createApartmentTradeHistoryHandler());
 const server=app.listen(0,'127.0.0.1'); await new Promise<void>(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+(server.address() as {port:number}).port;
 try {
  // Invalid selection goes through the real handler (no upstream use).
  const invalid=await fetch(base+path+'?complex=not-in-the-catalog');
  assert.equal(invalid.status,400);
  assert.deepEqual(await invalid.json(),{error:'TRADE_HISTORY_INVALID_SELECTION'});
  assert.equal(invalid.headers.get('cache-control'),'no-store');
  const head=await fetch(base+path,{method:'HEAD'});
  assert.equal(head.status,400);
  assert.equal(head.headers.get('cache-control'),'no-store');
  const limited=await fetch(base+path);
  assert.equal(limited.status,429);
  assert.equal(limited.headers.get('retry-after'),'60');
  for (const method of ['POST','PUT','DELETE']) {
   assert.equal((await fetch(base+path,{method})).status,401);
  }
  assert.equal((await fetch(base+path+'/unexpected')).status,401);
  assert.equal((await fetch(base+path+'/')).status,401);
  assert.equal((await fetch(base+'/api/jobs/poll')).status,401);
 } finally {await new Promise<void>(r=>server.close(()=>r()));}
});

test('Apt search is public for exact reads only', async () => {
 const app = express();
 const path = '/api/apt/search';
 app.use(createApiSecurity({ production: true, secret: () => 'test-secret' }));
 app.get(path, (_req, res) => res.status(200).json({ source: 'APT_FIRESTORE' }));
 const server = app.listen(0, '127.0.0.1');
 await new Promise<void>(resolve => server.once('listening', resolve));
 const base = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
 try {
  for (const method of ['GET', 'HEAD']) assert.equal((await fetch(base + path, { method })).status, 200);
  for (const method of ['POST', 'PUT', 'DELETE']) assert.equal((await fetch(base + path, { method })).status, 401);
  assert.equal((await fetch(base + path + '/other')).status, 401);
 } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
