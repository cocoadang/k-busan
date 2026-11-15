import https from 'node:https';
/** Fresh verified TLS connections for the legacy Busan city web endpoint only. */
export function createFreshCityFetch(requester:typeof https.request=https.request):typeof fetch {
 return async(input,init)=>{
  const url=new URL(String(input));
  if(url.protocol!=='https:'||!['www.busan.go.kr','busan.go.kr'].includes(url.hostname)||!url.pathname.startsWith('/nbgosi')||init?.method&&init.method!=='GET')throw Error('CITY_TRANSPORT_URL_REJECTED');
  return new Promise<Response>((resolve,reject)=>{
   const req=requester(url,{method:'GET',agent:false,rejectUnauthorized:true,signal:init?.signal||AbortSignal.timeout(15000),headers:{'User-Agent':'BusanRedevelopmentNewsMonitor/1.0','Accept-Encoding':'identity',...Object.fromEntries(new Headers(init?.headers))}},res=>{
    const parts:Buffer[]=[];let size=0;
    res.on('data',part=>{size+=part.length;if(size>2*1024*1024){res.destroy(Error('OFFICIAL_RESPONSE_LIMIT'));return;}parts.push(Buffer.from(part));});
    res.on('error',reject);res.on('end',()=>{const headers=new Headers();for(const[k,v]of Object.entries(res.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(', '):v);const status=res.statusCode||502;resolve(new Response([204,205,304].includes(status)?null:Buffer.concat(parts),{status,headers}));});
   });req.on('error',reject);req.end();
  });
 };
}
export const freshCityFetch=createFreshCityFetch();
