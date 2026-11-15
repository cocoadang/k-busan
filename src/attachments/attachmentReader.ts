import {inflateRawSync} from 'node:zlib';
import {imageSize} from 'image-size';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import AdmZip from 'adm-zip';
import {load} from 'cheerio';
import type {RawCollectedItem} from '../types/redevelopment';
const exec=promisify(execFile);
export type AttachmentPage={locator:string;text:string;method:'native'|'ocr'};
export type AttachmentResult={url:string;sha256?:string;format?:string;status:'verified'|'partial'|'failed';pages:AttachmentPage[];pageCount?:number;error?:string;checkedAt:number};
export interface AttachmentCache {get(url:string):Promise<AttachmentResult|null>;set(url:string,result:AttachmentResult):Promise<void>;}
const hosts=new Set(['dynamice.busan.go.kr','www.busan.go.kr','eminwon.gccity.go.kr']);
export function safeAttachmentUrl(value:string){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||!hosts.has(u.hostname))throw Error('ATTACHMENT_HOST_REJECTED');return u.toString();}
export async function downloadAttachment(url:string,fetcher:typeof fetch=fetch){let current=safeAttachmentUrl(url);for(let i=0;i<4;i++){
 const r=await fetcher(current,{redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(r.status>=300&&r.status<400){current=safeAttachmentUrl(new URL(r.headers.get('location')||'',current).toString());continue;}
 if(!r.ok||!r.body)throw Error(`ATTACHMENT_HTTP_${r.status}`);if(Number(r.headers.get('content-length')||0)>10*1024*1024)throw Error('ATTACHMENT_TOO_LARGE');
 const chunks:Uint8Array[]=[];let size=0;for await(const chunk of r.body as any){size+=chunk.length;if(size>10*1024*1024){await r.body.cancel().catch(()=>{});throw Error('ATTACHMENT_TOO_LARGE');}chunks.push(chunk);}return Buffer.concat(chunks);
 }throw Error('ATTACHMENT_REDIRECT_LIMIT');}
export function readableHwpText(text:string){return text.replace(/<(?:그림|표|개체)>/g,'').replace(/\s/g,'').length>=25;}
export async function extractAttachment(bytes:Buffer,url:string,previous?:AttachmentResult|null,deadline=Infinity):Promise<AttachmentResult>{
 const sha256=createHash('sha256').update(bytes).digest('hex'),result:AttachmentResult={url,sha256,status:'failed',pages:[],checkedAt:Date.now()};
 const dir=await mkdtemp(path.join(tmpdir(),'apt-attachment-'));
 const run=async(cmd:string,args:string[])=>{const remaining=Math.min(20000,deadline-Date.now());if(remaining<500)throw Error('ATTACHMENT_CYCLE_BUDGET_EXHAUSTED');return (await exec(cmd,args,{timeout:remaining,maxBuffer:3*1024*1024,encoding:'utf8'})).stdout;};
 try{
  if(bytes.subarray(0,5).toString()==='%PDF-'){
   result.format='pdf';const file=path.join(dir,'source.pdf');await writeFile(file,bytes);
   const info=await run('pdfinfo',[file]);const pageCount=Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);if(!pageCount||pageCount>40)throw Error('ATTACHMENT_PAGE_LIMIT');result.pageCount=pageCount;
   const texts=(await run('pdftotext',['-layout',file,'-'])).split('\f');let ocrs=0;
   for(let n=0;n<pageCount;n++){const locator=`p.${n+1}`,old=previous?.sha256===sha256?previous.pages.find(p=>p.locator===locator):undefined;if(old){result.pages.push(old);continue;}
    const native=(texts[n]||'').trim();if(native.replace(/\s/g,'').length>=25){result.pages.push({locator,text:native,method:'native'});continue;}
    if(ocrs>=3)continue;ocrs++;
    const prefix=path.join(dir,`page-${n+1}`);await run('pdftoppm',['-f',String(n+1),'-l',String(n+1),'-singlefile','-scale-to','1800','-png',file,prefix]);
    const text=(await run('tesseract',[prefix+'.png','stdout','-l','kor+eng'])).trim();if(text.replace(/\s/g,'').length>=25)result.pages.push({locator,text,method:'ocr'});
   }
  }else if(bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) || bytes.subarray(0,3).equals(Buffer.from('ffd8ff','hex'))){
   result.format='image';const size=imageSize(bytes);if(!size.width||!size.height||size.width*size.height>20000000)throw Error('ATTACHMENT_IMAGE_PIXEL_LIMIT');const file=path.join(dir,'source.png');await writeFile(file,bytes);const text=(await run('tesseract',[file,'stdout','-l','kor+eng'])).trim();if(text.replace(/\s/g,'').length>=25)result.pages=[{locator:'image.1',text,method:'ocr'}];result.pageCount=1;
  }else if(bytes[0]===0x50&&bytes[1]===0x4b){
   result.format='hwpx';const zip=new AdmZip(bytes),entries=zip.getEntries().filter(e=>/^Contents\/section\d+\.xml$/i.test(e.entryName)).sort((a,b)=>a.entryName.localeCompare(b.entryName,undefined,{numeric:true}));
   if(!entries.length||entries.length>40)throw Error('ATTACHMENT_UNSUPPORTED_ZIP');let total=0;
   for(const e of entries){total+=e.header.size;if(total>3*1024*1024)throw Error('ATTACHMENT_ZIP_TOO_LARGE');const compressed=e.getCompressedData();if(![0,8].includes(e.header.method))throw Error('ATTACHMENT_ZIP_METHOD');const xml=e.header.method===0?compressed:inflateRawSync(compressed,{maxOutputLength:3*1024*1024});if(xml.length>e.header.size || xml.length>3*1024*1024)throw Error('ATTACHMENT_ZIP_TOO_LARGE');const $=load(xml.toString('utf8'),{xml:true});const text=$('*').filter((_,el)=>/^(?:\w+:)?t$/.test((el as any).tagName || '')).map((_,el)=>$(el).text()).get().join(' ');if(text.trim())result.pages.push({locator:e.entryName,text,method:'native'});}result.pageCount=entries.length;
  }else if(bytes.subarray(0,8).equals(Buffer.from('d0cf11e0a1b11ae1','hex'))){
   result.format='hwp';const file=path.join(dir,'source.hwp');await writeFile(file,bytes);const text=(await run('hwp5txt',[file])).trim();if(!readableHwpText(text))throw Error('ATTACHMENT_HWP_IMAGE_ONLY_OR_EMPTY');result.pages=[{locator:'본문 (쪽번호 미제공)',text,method:'native'}];result.pageCount=1;
  }else throw Error('ATTACHMENT_UNSUPPORTED_FORMAT');
  if(result.pages.reduce((s,p)=>s+p.text.length,0)>60000)throw Error('ATTACHMENT_TEXT_LIMIT');
  result.status=result.pages.length===result.pageCount?'verified':'partial';if(result.status==='partial')result.error='ATTACHMENT_MORE_PAGES_REQUIRED';
 }catch(e:any){result.status='failed';result.error=/^ATTACHMENT_/.test(e.message)?e.message:e.code==='ENOENT'?'ATTACHMENT_TOOL_UNAVAILABLE':'ATTACHMENT_EXTRACTION_FAILED';}
 finally{await rm(dir,{recursive:true,force:true});}return result;
}
export class AttachmentReader {
 constructor(private cache?:AttachmentCache,private fetcher:typeof fetch=fetch){}
 async read(url:string,deadline=Infinity){safeAttachmentUrl(url);const previous=await this.cache?.get(url);if(previous?.status==='verified' && Date.now()-previous.checkedAt<6*3600000)return previous;
  let result:AttachmentResult;try{result=await extractAttachment(await downloadAttachment(url,this.fetcher),url,previous,deadline);}catch(e:any){result={url,status:'failed',pages:[],error:/^ATTACHMENT_/.test(e.message)?e.message:'ATTACHMENT_DOWNLOAD_FAILED',checkedAt:Date.now()};}
  await this.cache?.set(url,result);return result;
 }
 async enrich(item:RawCollectedItem,deadline=Infinity):Promise<RawCollectedItem>{const urls=[...new Set(item.attachmentUrls||[])];if(!urls.length)return {...item,attachmentContentStatus:'not_applicable'};
  if(urls.length>5)throw Error('ATTACHMENT_COUNT_LIMIT');const results:AttachmentResult[]=[];for(const url of urls){if(Date.now()+5000>=deadline)throw Error('ATTACHMENT_CYCLE_BUDGET_EXHAUSTED');results.push(await this.read(url,deadline));}
  if(results.some(r=>r.status!=='verified'))throw Error(results.find(r=>r.status!=='verified')!.error||'ATTACHMENT_INCOMPLETE');
  const content=item.content+'\n'+results.map(r=>`[첨부 원문 ${r.url} SHA256 ${r.sha256}]\n`+r.pages.map(p=>`[${p.locator} / ${p.method}]\n${p.text}`).join('\n')).join('\n');
  if(content.length>90000)throw Error('ATTACHMENT_TOTAL_TEXT_LIMIT');return {...item,content,detailVerified:true,attachmentContentStatus:'verified',attachmentEvidence:results.map(r=>({url:r.url,sha256:r.sha256!,pages:r.pages.map(p=>({locator:p.locator,method:p.method})),checkedAt:r.checkedAt}))};
 }
}
export function firestoreAttachmentCache(db:any):AttachmentCache{const ref=(url:string)=>db.collection('attachmentTexts').doc(createHash('sha256').update(url).digest('hex'));return {get:async url=>(await ref(url).get()).data()?.result||null,set:async(url,result)=>{await ref(url).set({result:JSON.parse(JSON.stringify(result)),expiresAt:new Date(Date.now()+30*86400000)});}};}
