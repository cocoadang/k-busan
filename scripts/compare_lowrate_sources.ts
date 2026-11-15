import https from 'node:https';
import {createOfficialRequestGovernor} from '../src/collector/officialRequestGovernor';
async function main(){
 if(Object.keys(process.env).some(k=>/TELEGRAM|OPENAI|GEMINI/.test(k)))throw Error('NOTIFICATION_AND_AI_CREDENTIALS_FORBIDDEN');
 const day=new Date(Date.now()+9*3600000).toISOString().slice(0,10).replaceAll('-','');
 let key=process.env.DATA_GO_KR_API_KEY?.trim()||'';try{if(/%[0-9a-f]{2}/i.test(key))key=decodeURIComponent(key);}catch{}
 const targets=[['city','https://www.busan.go.kr/nbgosi'],['association','https://dynamice.busan.go.kr/view.do?no=287'],['saeol','https://apis.data.go.kr/6260000/SaeolAncmntInfoService/getSaeolAncmntInfo?serviceKey='+encodeURIComponent(key)+'&pageNo=1&numOfRows=1&resultType=json&pbltnYmd='+day]];
 const blocked=new Set<string>(),headers={'User-Agent':'BusanRedevelopmentNewsMonitor/1.0',Accept:'text/html,application/json'};
 const paced=createOfficialRequestGovernor({intervalMs:3000,cooldownMs:60000});
 for(const[host,url]of targets){const start=Date.now();try{const r=await paced(url,{headers,redirect:'manual',signal:AbortSignal.timeout(20000)});const text=await r.text();if([403,429,503].includes(r.status))blocked.add(host);console.log('LOWRATE '+JSON.stringify({phase:'A_3s_serial_fetch',host,status:r.status,bytes:Buffer.byteLength(text),ms:Date.now()-start}));}catch(e:any){console.log('LOWRATE '+JSON.stringify({phase:'A_3s_serial_fetch',host,error:e.cause?.code||e.name,ms:Date.now()-start}));}}
 console.log('QUIET_WINDOW_START 120s');await new Promise(r=>setTimeout(r,120000));
 for(const[host,url]of targets){if(blocked.has(host)){console.log('LOWRATE '+JSON.stringify({phase:'B_8s_fresh_https',host,skipped:'ACCESS_OR_RATE_RESTRICTION'}));continue;}
  await new Promise(r=>setTimeout(r,8000));const start=Date.now();
  await new Promise<void>(resolve=>{let done=false;const finish=(data:any)=>{if(!done){done=true;console.log('LOWRATE '+JSON.stringify({phase:'B_8s_fresh_https',host,...data,ms:Date.now()-start}));resolve();}};const req=https.get(url,{agent:false,headers,signal:AbortSignal.timeout(20000)},res=>{let bytes=0;res.on('data',b=>{bytes+=b.length;if(bytes>2*1024*1024)res.destroy(Error('RESPONSE_LIMIT'));});res.on('end',()=>finish({status:res.statusCode,bytes}));res.on('error',e=>finish({error:(e as any).code||e.name}));});req.on('error',e=>finish({error:(e as any).code||e.name}));});
 }
 console.log('LOWRATE_DONE telegramSent=0 automaticRetries=0');
}
main().catch(e=>{console.error('LOWRATE_FAILED '+e.name);process.exitCode=1});
