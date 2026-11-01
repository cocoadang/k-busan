import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AssociationNoticeCollector, parseAssociationDetail} from '../collector/associationCollector';
import {REDEVELOPMENT_SEED_PROJECTS} from '../registry/redevelopmentRegistry';
const url='https://dynamice.busan.go.kr/home/BARA_0000000000151/view.do?no=329&ntt_id=20680&pgMode=view';
const captured=readFileSync(new URL('./fixtures/union-detail-20261029.html',import.meta.url),'utf8');
const list=`<table><tr><td><a href="${url.replaceAll('&','&amp;')}">촉진3구역 입찰 공고</a></td><td>2026-10-08</td></tr></table>`;
const project=REDEVELOPMENT_SEED_PROJECTS.find(p=>p.id==='chokjin-3')!;
async function collect(detail: string) {
  const calls: string[]=[];
  const fetcher=(async(u:any)=>{calls.push(String(u));return new Response(String(u).includes('ntt_id')?detail:list);}) as typeof fetch;
  const result=await new AssociationNoticeCollector(fetcher,()=>new Date('2026-10-10T00:00:00Z')).fetchForProject(project,{maxPages:1});
  return {result,calls};
}
test('captured public JS and collector encode the same attachment parameter exactly once',()=>{
  assert.match(captured,/encodeURIComponent\(atchFileId\)/);
  const argument=captured.match(/fn_egov_downFile\('([^']+)','1'\)/)![1];
  // Model URL decoding as data only: never evaluate the original JavaScript.
  const scriptUrl=captured.match(/javascript:fn_egov_downFile\('[^']+','1'\)/)![0];
  const decodedWholeArgument=decodeURIComponent(scriptUrl.slice('javascript:'.length)).match(/^fn_egov_downFile\('([^']+)','1'\)$/)![1];
  assert.equal(decodedWholeArgument,decodeURIComponent(argument));
  const expected=new URL(`/cmm/fms/FileDown.do?atchFileId=${encodeURIComponent(decodeURIComponent(argument))}&fileSn=1`,url);
  assert.equal(parseAssociationDetail(captured,url).attachments[0],expected.toString());
  const observedButtonDestination='https://dynamice.busan.go.kr/cmm/fms/FileDown.do?atchFileId=cx%2FkwSBivSgCWAb6LQl1VsZfC66U6UI68b9jjwGleXs%3D&fileSn=1';
  assert.equal(expected.toString(),observedButtonDestination);
  const oldUrl=new URL('/cmm/fms/FileDown.do',url);
  oldUrl.searchParams.set('atchFileId',argument);oldUrl.searchParams.set('fileSn','1');
  assert.notEqual(expected.toString(),oldUrl.toString());
  assert.match(oldUrl.toString(),/cx%252F.*%253D/);
  assert.equal(expected.searchParams.get('atchFileId'),'cx/kwSBivSgCWAb6LQl1VsZfC66U6UI68b9jjwGleXs=');
});
test('public JavaScript attachment argument is decoded exactly once',()=>{
  const html='<div class="bbs_view_cont"></div><a class="board-view-fileDown" href="javascript:fn_egov_downFile(\'abc%252Fdef%253D\',\'1\')">file</a>';
  assert.equal(new URL(parseAssociationDetail(html,url).attachments[0]).searchParams.get('atchFileId'),'abc%2Fdef%3D');
});
test('malformed encoded attachment ID fails closed',()=>{
  const html='<div class="bbs_view_cont"></div><a class="board-view-fileDown" href="javascript:fn_egov_downFile(\'abc%ZZ\',\'1\')">file</a>';
  assert.throws(()=>parseAssociationDetail(html,url),URIError);
});
test('malformed escape affects its notice only and later notices are still collected',async()=>{
  const secondUrl=url.replace('20680','20681');
  const twoNotices=list.replace('</table>',list.replace('<table>','').replaceAll('20680','20681'));
  const malformed='<div class="bbs_view_cont">Public notice body.</div><a class="board-view-fileDown" href="javascript:fn_egov_downFile(\'abc%ZZ\',\'1\')">file</a>';
  const calls:string[]=[];
  const fetcher=(async(u:any)=>{const target=String(u);calls.push(target);return new Response(target.includes('ntt_id=20680')?malformed:target.includes('ntt_id=20681')?'<div class="bbs_view_cont">Second verified public notice body.</div>':twoNotices);}) as typeof fetch;
  const result=await new AssociationNoticeCollector(fetcher,()=>new Date('2026-10-10T00:00:00Z')).fetchForProject(project,{maxPages:1});
  assert.equal(result.items.length,2);
  assert.equal(result.items[0].detailVerified,false);
  assert.equal(result.items[1].detailVerified,true);
  assert.equal(new URL(result.items[1].sourceUrl).searchParams.get('ntt_id'),new URL(secondUrl).searchParams.get('ntt_id'));
  assert.match(result.error!,/URI malformed/);
  assert.ok(calls.some(u=>u.includes('ntt_id=20681')));
});
test('ordinary download URL keeps percent-encoded parameter values unchanged',()=>{
  const href='https://dynamice.busan.go.kr/cmm/fms/FileDown.do?atchFileId=abc%252Fdef%253D&fileSn=1';
  const html=`<div class="bbs_view_cont">Public notice body.</div><a href="${href.replaceAll('&','&amp;')}">file</a>`;
  assert.deepEqual(parseAssociationDetail(html,url).attachments,[href]);
});
test('HTML body with unread attachment remains incomplete without falsely rejecting HTML evidence',async()=>{
  const {result,calls}=await collect('<div class="bbs_view_cont">This is verified public notice body text.</div><a href="/download.do?id=1">PDF</a>');
  assert.equal(result.items[0].detailVerified,true);
  assert.equal(result.items[0].attachmentContentStatus,'unverified');
  assert.match(result.error!,/ATTACHMENT_CONTENT_UNVERIFIED/);
  assert.ok(calls.every(u=>!u.includes('/download.do')),'no new attachment requests or hidden side effects');
});
test('body without attachment can complete normally',async()=>{
  const {result}=await collect('<div class="bbs_view_cont">This is verified public notice body text.</div>');
  assert.equal(result.error,undefined);
  assert.equal(result.items[0].detailVerified,true);
  assert.equal(result.items[0].attachmentContentStatus,'not_applicable');
});
test('captured attachment-only page never becomes completed or text-verified',async()=>{
  const {result}=await collect(captured);
  assert.equal(result.items[0].detailVerified,false);
  assert.equal(result.items[0].attachmentContentStatus,'unverified');
  assert.equal(result.items[0].attachmentUrls?.length,2);
  assert.match(result.error!,/ATTACHMENT_CONTENT_UNVERIFIED/);
});
