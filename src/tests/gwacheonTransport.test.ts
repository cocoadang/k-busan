import test from 'node:test';
import assert from 'node:assert/strict';
import { GwacheonCityNoticeCollector } from '../collector/officialCollector';
import { REDEVELOPMENT_SEED_PROJECTS } from '../registry/redevelopmentRegistry';

const project = REDEVELOPMENT_SEED_PROJECTS.find(p => p.id === 'gwacheon-10')!;
const list = '<form id="list"><input name="page" value="1"></form><table class="bod_list gosi"><tbody><tr><td>�ڷᰡ �����ϴ�</td></tr></tbody></table>';
const socket = () => new TypeError('fetch failed', {cause: Object.assign(new Error('socket closed'), {code:'UND_ERR_SOCKET'})});
const run = (fetcher: typeof fetch) => new GwacheonCityNoticeCollector(fetcher, () => new Date('2026-11-03T00:00:00Z')).fetchForProjects([project]);

test('Gwacheon retries a dropped response body once on the same URL', async () => {
  const urls: string[] = [];
  const result = await run((async input => {
    urls.push(String(input));
    if (urls.length === 1) return Object.assign(new Response(list),{text:async()=>{throw socket();}});
    return new Response(list);
  }) as typeof fetch);
  assert.equal(result.error, undefined);
  assert.equal(result.pagesRead,2);
  assert.equal(urls.length,3);
  assert.equal(urls[0],urls[1]);
});

test('Gwacheon persistent socket failure is bounded and identifies the failed request', async () => {
  let calls=0;
  const result=await run((async()=>{calls++;throw socket();}) as typeof fetch);
  assert.equal(calls,4);
  assert.equal(result.pagesRead,0);
  assert.match(result.error!,/UND_ERR_SOCKET/);
  assert.match(result.error!,/phase=headers/);
  assert.match(result.error!,/attempts=2/);
  assert.match(result.error!,/seCode=01/);
  assert.match(result.error!,/seCode=02/);
});

test('Gwacheon body failure retains incomplete status and body phase', async () => {
  const result=await run((async()=>(Object.assign(new Response(list),{text:async()=>{throw socket();}}))) as typeof fetch);
  assert.equal(result.pagesRead,0);
  assert.match(result.error!,/phase=body/);
  assert.match(result.error!,/attempts=2/);
});

for (const status of [403,429]) test(`Gwacheon HTTP ${status} stops all further requests`, async()=>{
  let calls=0;
  const result=await run((async()=>{calls++;return new Response('restricted',{status});}) as typeof fetch);
  assert.equal(calls,1);
  assert.match(result.error!,new RegExp(`GWACHEON_HTTP_${status}`));
});

test('Gwacheon certificate failures are never retried',async()=>{
  let calls=0;
  const result=await run((async()=>{calls++;throw new TypeError('fetch failed',{cause:{code:'CERT_HAS_EXPIRED'}});}) as typeof fetch);
  assert.equal(calls,2);
  assert.match(result.error!,/CERT_HAS_EXPIRED/);
});

test('Gwacheon invalid HTML fails closed without transport retries',async()=>{
  let calls=0;
  const result=await run((async()=>{calls++;return new Response('<html>Unexpected page</html>');}) as typeof fetch);
  assert.equal(calls,2);
  assert.match(result.error!,/GWACHEON_LIST_UNVERIFIED/);
});

test('Gwacheon header socket retry waits and does not duplicate a recovered notice',async()=>{
  const title='��õ�ְ�10���� ����� ����';
  const detailUrl='/portal/saeol/gosi/view.do?notAncmtMgtNo=123';
  const row=`<form id="list"><input name="page" value="1"></form><table class="bod_list gosi"><tbody><tr><td><a data-action="${detailUrl}">${title}</a></td><td class="list_date">2026-11-03</td></tr></tbody></table>`;
  const detail=`<div class="bod_view"><h4>${title}</h4><div class="view_date">2026-11-03</div><div class="view_cont">��õ�ְ�10���� ����� �������� ���� ���� �����Դϴ�.</div></div>`;
  const calls:{url:string;at:number}[]=[];
  const result=await run((async input=>{
    const url=String(input);calls.push({url,at:Date.now()});
    if(calls.length===1)throw socket();
    return new Response(url.includes('view.do')?detail:row);
  }) as typeof fetch);
  assert.equal(result.error,undefined);
  assert.equal(result.items.length,1);
  assert.equal(calls[0].url,calls[1].url);
  assert.ok(calls[1].at-calls[0].at>=450);
  assert.equal(calls.filter(c=>c.url.includes('view.do')).length,1);
});

test('Gwacheon body timeout ends within the shared deadline without another attempt',async()=>{
  let calls=0;
  const start=Date.now();
  const fetcher=(async(_input,init)=>{
    calls++;
    return {ok:true,status:200,text:()=>new Promise((_resolve,reject)=>{
      const watchdog=setTimeout(()=>reject(new Error('test watchdog')),1000);
      init!.signal!.addEventListener('abort',()=>{clearTimeout(watchdog);reject(init!.signal!.reason);},{once:true});
    })} as Response;
  }) as typeof fetch;
  const result=await new GwacheonCityNoticeCollector(fetcher).fetchForProjects([project],{timeoutMs:30});
  assert.equal(calls,2); // two independent notice categories, one attempt each
  assert.match(result.error!,/TimeoutError.*phase=body attempts=1/);
  assert.ok(Date.now()-start<700);
});

test('Gwacheon forbidden redirects never reach another host or retry',async()=>{
  const calls:string[]=[];
  const result=await run((async input=>{calls.push(String(input));return new Response(null,{status:302,headers:{location:'https://example.invalid/private'}});}) as typeof fetch);
  assert.equal(calls.length,2);
  assert.ok(calls.every(url=>new URL(url).hostname==='www.gccity.go.kr'));
  assert.match(result.error!,/GWACHEON_REDIRECT_REJECTED.*attempts=1/);
});

test('Gwacheon unknown failures do not retry or expose raw error text',async()=>{
  let calls=0;
  const result=await run((async()=>{calls++;throw new Error('private arbitrary error text');}) as typeof fetch);
  assert.equal(calls,2);
  assert.doesNotMatch(result.error!,/private arbitrary/);
  assert.match(result.error!,/GWACHEON_FETCH_FAILED/);
});
