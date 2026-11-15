import{spawnSync}from'node:child_process';
import{freshCityFetch}from'../src/collector/freshCityFetch';
async function main(){
 if(Object.keys(process.env).some(k=>/TELEGRAM|OPENAI|GEMINI/.test(k)))throw Error('NOTIFICATION_AND_AI_CREDENTIALS_FORBIDDEN');
 const t=Date.now();try{const r=await freshCityFetch('https://www.busan.go.kr/nbgosi',{signal:AbortSignal.timeout(20000),headers:{Accept:'text/html,application/xhtml+xml'}});const b=await r.text();console.log('CITY_IMPL '+JSON.stringify({implementation:'node',status:r.status,bytes:Buffer.byteLength(b),ms:Date.now()-t}));}catch(e:any){console.log('CITY_IMPL '+JSON.stringify({implementation:'node',error:e.cause,ms:Date.now()-t}));}
 console.log('CITY_IMPL_QUIET 60s');await new Promise(r=>setTimeout(r,60000));
 const python=`import ssl,urllib.request,urllib.error,os,json,time,hashlib
start=time.time()
ctx=ssl.create_default_context()
extra=os.environ.get('NODE_EXTRA_CA_CERTS')
if extra: ctx.load_verify_locations(cafile=extra)
ctx.minimum_version=ssl.TLSVersion.TLSv1_2
ctx.maximum_version=ssl.TLSVersion.TLSv1_2
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs): return None
opener=urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx),NoRedirect())
request=urllib.request.Request('https://www.busan.go.kr/nbgosi',headers={'User-Agent':'BusanRedevelopmentNewsMonitor/1.0','Accept-Encoding':'identity','Accept':'text/html,application/xhtml+xml'},method='GET')
try:
 try: response=opener.open(request,timeout=20)
 except urllib.error.HTTPError as e: response=e
 data=response.read(2097153)
 print(json.dumps({'implementation':'python','openssl':ssl.OPENSSL_VERSION,'verified':ctx.check_hostname and ctx.verify_mode==ssl.CERT_REQUIRED,'status':response.status,'bytes':len(data),'startsHtml':data.lstrip().startswith(b'<'),'sha256':hashlib.sha256(data).hexdigest(),'ms':round((time.time()-start)*1000)}))
except Exception as e: print(json.dumps({'implementation':'python','openssl':ssl.OPENSSL_VERSION,'error':type(e).__name__,'reason':type(getattr(e,'reason',None)).__name__,'ms':round((time.time()-start)*1000)}))`;
 const r=spawnSync('python3',['-c',python],{encoding:'utf8',timeout:25000,maxBuffer:8192});console.log('CITY_IMPL '+r.stdout.trim());if(r.status!==0)throw Error('PYTHON_CHECK_FAILED');
}
main().catch(e=>{console.error(e.name);process.exitCode=1});
