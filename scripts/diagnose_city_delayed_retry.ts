import{freshCityFetch}from'../src/collector/freshCityFetch';
import{createOfficialRequestGovernor}from'../src/collector/officialRequestGovernor';
async function main(){
 if(Object.keys(process.env).some(k=>/TELEGRAM|OPENAI|GEMINI/.test(k)))throw Error('NOTIFICATION_AND_AI_CREDENTIALS_FORBIDDEN');
 const paced=createOfficialRequestGovernor({intervalMs:8000,cooldownMs:60000,fetcher:freshCityFetch});
 for(let attempt=0;attempt<2;attempt++){
  if(attempt){console.log('CITY_RETRY_QUIET 65s');await new Promise(r=>setTimeout(r,65000));}
  const t=Date.now();try{const r=await paced('https://www.busan.go.kr/nbgosi',{signal:AbortSignal.timeout(20000),headers:{Accept:'text/html,application/xhtml+xml'}});const body=await r.text();console.log('CITY_RETRY '+JSON.stringify({attempt,implementation:'same-node-client',status:r.status,bytes:Buffer.byteLength(body),ms:Date.now()-t}));if([403,429,503].includes(r.status))break;}catch(e:any){console.log('CITY_RETRY '+JSON.stringify({attempt,error:e.cause||e.name,ms:Date.now()-t}));}
 }
}
main().catch(e=>{console.error(e.name);process.exitCode=1});
