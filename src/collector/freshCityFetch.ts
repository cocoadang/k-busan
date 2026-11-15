import https from 'node:https';
/** Fresh, certificate-verified TLS 1.2 for the legacy Busan city endpoint only. */
export function createFreshCityFetch(requester:typeof https.request=https.request):typeof fetch {
 return async(input,init)=>{
  const url=new URL(String(input));
  if(url.protocol!=='https:'||!['www.busan.go.kr','busan.go.kr'].includes(url.hostname)||!url.pathname.startsWith('/nbgosi')||init?.method&&init.method!=='GET')throw Error('CITY_TRANSPORT_URL_REJECTED');
  return new Promise<Response>((resolve,reject)=>{
   const started=Date.now();let phase='dns_or_tcp',bytes=0,settled=false;
   const fail=(e:any)=>{if(settled)return;settled=true;const code=e.code||e.name||'UNKNOWN';const diagnostic={phase,code,bodyBytes:bytes,elapsedMs:Date.now()-started};
    console.warn('[CITY_TRANSPORT]',JSON.stringify(diagnostic));
    reject(new Error(`CITY_TRANSPORT_FAILED phase=${phase} code=${code} bytes=${bytes}`,{cause:{code,phase}}));};
   const req=requester(url,{method:'GET',agent:false,rejectUnauthorized:true,minVersion:'TLSv1.2',maxVersion:'TLSv1.2',signal:init?.signal||AbortSignal.timeout(15000),headers:{'User-Agent':'BusanRedevelopmentNewsMonitor/1.0','Accept-Encoding':'identity',...Object.fromEntries(new Headers(init?.headers))}},res=>{
    phase='body';const parts:Buffer[]=[];
    res.on('data',part=>{bytes+=part.length;if(bytes>2*1024*1024){res.destroy(Object.assign(Error('OFFICIAL_RESPONSE_LIMIT'),{code:'OFFICIAL_RESPONSE_LIMIT'}));return;}parts.push(Buffer.from(part));});
    res.on('aborted',()=>fail({code:'ECONNRESET'}));res.on('error',fail);
    res.on('end',()=>{if(settled)return;if(res.complete===false){fail({code:'CITY_INCOMPLETE_BODY'});return;}settled=true;const headers=new Headers();for(const[k,v]of Object.entries(res.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(', '):v);const status=res.statusCode||502;resolve(new Response([204,205,304].includes(status)?null:Buffer.concat(parts),{status,headers}));});
   });
   req.on('socket',socket=>{phase='tcp';socket.once('connect',()=>{phase='tls'});socket.once('secureConnect',()=>{phase='headers'});});
   req.on('error',fail);req.end();
  });
 };
}
export const freshCityFetch=createFreshCityFetch();
