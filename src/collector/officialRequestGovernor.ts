import { pythonCityFetch } from './pythonCityFetch';
/** Shared governor across the Busan city, association and API collectors. */
export function createOfficialRequestGovernor(options:{intervalMs:number;cooldownMs:number;intervalForHost?:(host:string)=>number;fetcher?:typeof fetch}) {
 let tail=Promise.resolve(),lastFinished=0;
 const blockedUntil=new Map<string,number>();
 return async (input:Parameters<typeof fetch>[0],init?:RequestInit):Promise<Response>=>{
  const host=new URL(String(input)).hostname;
  let release!:()=>void;const before=tail;tail=new Promise<void>(r=>{release=r;});
  await before;
  let started=false;
  try{
   if(init?.signal?.aborted)throw init.signal.reason;
   if(Date.now()<(blockedUntil.get(host)||0))throw Error('OFFICIAL_HOST_COOLDOWN');
   const wait=Math.max(0,lastFinished+(options.intervalForHost?.(host)??options.intervalMs)-Date.now());
   if(wait)await new Promise<void>((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(init?.signal?.reason)};const timer=setTimeout(()=>{init?.signal?.removeEventListener('abort',abort);resolve()},wait);init?.signal?.addEventListener('abort',abort,{once:true});});
   if(init?.signal?.aborted)throw init.signal.reason;
   let response:Response;
   try{started=true;response=await (options.fetcher||fetch)(input,init);}catch(e){if(options.cooldownMs)blockedUntil.set(host,Date.now()+options.cooldownMs);throw e;}
   if([403,429,503].includes(response.status)&&options.cooldownMs){
    const retry=response.headers.get('retry-after');const seconds=retry&&/^\d+$/.test(retry)?Number(retry):retry?Math.max(0,(Date.parse(retry)-Date.now())/1000):0;
    blockedUntil.set(host,Date.now()+Math.max(options.cooldownMs,(Number.isFinite(seconds)?Math.max(0,seconds*1000):options.cooldownMs)));
   }
   if(!response.body)return response;
   // Keep the slot until the response is fully consumed; headers alone do not end a request.
   const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;
   try{for(;;){const row=await reader.read();if(row.done)break;length+=row.value.length;if(length>2*1024*1024){await reader.cancel();throw Error('OFFICIAL_RESPONSE_LIMIT');}chunks.push(row.value);}}finally{reader.releaseLock();}
   const headers=new Headers(response.headers);headers.delete('content-encoding');headers.delete('content-length');
   return new Response(Buffer.concat(chunks),{status:response.status,statusText:response.statusText,headers});
  }catch(e){if(started&&options.cooldownMs)blockedUntil.set(host,Math.max(blockedUntil.get(host)||0,Date.now()+options.cooldownMs));throw e;}finally{lastFinished=Date.now();release();}
 };
}
const production=process.env.NODE_ENV==='production';
export const pacedOfficialFetch=createOfficialRequestGovernor({intervalMs:production?Math.max(1000,Number(process.env.OFFICIAL_REQUEST_INTERVAL_MS)||3000):0,cooldownMs:production?60000:0,intervalForHost:host=>production&&['www.busan.go.kr','busan.go.kr'].includes(host)?8000:production?Math.max(1000,Number(process.env.OFFICIAL_REQUEST_INTERVAL_MS)||3000):0,fetcher:(input,init)=>production&&['www.busan.go.kr','busan.go.kr'].includes(new URL(String(input)).hostname)?pythonCityFetch(input,init):fetch(input,init)});
