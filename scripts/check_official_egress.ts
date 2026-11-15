import {BusanCityNoticeCollector,OfficialNoticeCollector,getKstDateString} from '../src/collector/officialCollector';
import {AssociationNoticeCollector} from '../src/collector/associationCollector';
import {REDEVELOPMENT_SEED_PROJECTS} from '../src/registry/redevelopmentRegistry';
async function main(){
 if(Object.keys(process.env).some(k=>/TELEGRAM|OPENAI|GEMINI/.test(k)))throw Error('NOTIFICATION_AND_AI_CREDENTIALS_FORBIDDEN');
 const ip=await (await fetch('https://checkip.amazonaws.com',{signal:AbortSignal.timeout(30000)})).text();console.log('EGRESS_IP '+ip.trim());
 if(ip.trim()!=='34.64.198.132')throw Error('EXPECTED_STATIC_EGRESS_REQUIRED');
 const projects=REDEVELOPMENT_SEED_PROJECTS.filter(p=>p.city==='부산광역시');let failed=false;
 for(let round=0;round<3;round++){
  const started=Date.now();const api=new OfficialNoticeCollector();api.beginRun();
  try{
   const [city,association,saeol]=await Promise.all([new BusanCityNoticeCollector().fetchForProjects(projects),new AssociationNoticeCollector().fetchForProject(projects.find(p=>p.associationBoard)!),api.fetchAllNoticesForDate(getKstDateString(),{timeoutMs:15000})]);
   const row={round,ms:Date.now()-started,city:{error:city.error||null,items:city.items.length},association:{error:association.error||null,items:association.items.length},saeol:{success:saeol.success,resultCode:saeol.resultCode,totalCount:saeol.totalCount,error:saeol.error||null}};
   console.log('EGRESS_ROUND '+JSON.stringify(row));if(city.error||association.error||!saeol.success)failed=true;
  }finally{api.endRun();}
 }
 if(failed)process.exitCode=1;
}
main().catch(e=>{console.error('EGRESS_CHECK_FAILED '+e.name+': '+e.message.replace(/serviceKey=[^& ]+/g,'serviceKey=REDACTED'));process.exitCode=1});
