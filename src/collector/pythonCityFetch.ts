import {spawn} from 'node:child_process';
export const CITY_PYTHON_REQUEST=String.raw`
import ssl,urllib.request,urllib.error,os,json,sys,base64,socket,errno
try:
 args=json.load(sys.stdin)
 ctx=ssl.create_default_context()
 extra=os.environ.get('NODE_EXTRA_CA_CERTS')
 if extra: ctx.load_verify_locations(cafile=extra)
 ctx.minimum_version=ssl.TLSVersion.TLSv1_2
 ctx.maximum_version=ssl.TLSVersion.TLSv1_2
 assert ctx.check_hostname and ctx.verify_mode==ssl.CERT_REQUIRED
 class NoRedirect(urllib.request.HTTPRedirectHandler):
  def redirect_request(self,*args,**kwargs): return None
 opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPSHandler(context=ctx),NoRedirect())
 request=urllib.request.Request(args['url'],headers=args['headers'],method='GET')
 try: response=opener.open(request,timeout=15)
 except urllib.error.HTTPError as e: response=e
 data=response.read(2097153)
 if len(data)>2097152: raise ValueError('BODY_LIMIT')
 print(json.dumps({'status':response.status,'headers':list(response.headers.items()),'body':base64.b64encode(data).decode('ascii')}))
except Exception as error:
 reason=getattr(error,'reason',error)
 code='CITY_HTTPS_FAILED'
 if isinstance(reason,ssl.SSLCertVerificationError): code='CERTIFICATE_VERIFY_FAILED'
 elif isinstance(reason,(TimeoutError,socket.timeout)): code='ETIMEDOUT'
 elif isinstance(reason,ConnectionResetError) or getattr(reason,'errno',None)==errno.ECONNRESET: code='ECONNRESET'
 elif isinstance(error,ValueError) and str(error)=='BODY_LIMIT': code='OFFICIAL_RESPONSE_LIMIT'
 print(json.dumps({'error':code}))
`;
/** Uses the existing system OpenSSL client, without credentials, proxying or redirect following. */
export function createPythonCityFetch(spawnProcess:typeof spawn=spawn):typeof fetch {
 return async(input,init)=>{
  const url=new URL(String(input));
  if(url.protocol!=='https:'||url.port||url.username||url.password||!['www.busan.go.kr','busan.go.kr'].includes(url.hostname)||!url.pathname.startsWith('/nbgosi')||(init?.method&&init.method!=='GET'))throw Error('CITY_TRANSPORT_URL_REJECTED');
  if(init?.signal?.aborted)throw init.signal.reason;
  return new Promise<Response>((resolve,reject)=>{
   const started=Date.now();let settled=false,output='',bytes=0;let child:ReturnType<typeof spawn>;
   let timer:ReturnType<typeof setTimeout>|undefined;
   const cleanup=()=>{if(timer)clearTimeout(timer);init?.signal?.removeEventListener('abort',abort)};
   const fail=(code:string)=>{if(settled)return;settled=true;cleanup();child?.kill();console.warn('[CITY_TRANSPORT]',JSON.stringify({implementation:'python-system-openssl',code,elapsedMs:Date.now()-started}));reject(new Error('CITY_TRANSPORT_FAILED code='+code,{cause:{code}}));};
   const abort=()=>fail('ABORT_ERR');
   const env:NodeJS.ProcessEnv={PATH:process.env.PATH||'',LANG:'C.UTF-8',PYTHONIOENCODING:'utf-8'};
   if(process.env.NODE_EXTRA_CA_CERTS)env.NODE_EXTRA_CA_CERTS=process.env.NODE_EXTRA_CA_CERTS;
   try{child=spawnProcess('python3',['-c',CITY_PYTHON_REQUEST],{env,stdio:['pipe','pipe','pipe']});}catch{fail('CITY_PYTHON_UNAVAILABLE');return;}
   timer=setTimeout(()=>fail('ETIMEDOUT'),16000);init?.signal?.addEventListener('abort',abort,{once:true});
   child.stdout!.on('data',part=>{bytes+=part.length;if(bytes>3*1024*1024){fail('OFFICIAL_RESPONSE_LIMIT');return;}output+=part.toString('utf8');});
   // Never expose interpreter stderr (which can include local paths or the request).
   child.stderr!.resume();child.stdin!.on('error',()=>fail('CITY_PYTHON_IO_ERROR'));
   child.on('error',(e:any)=>fail(e.code==='ENOENT'?'CITY_PYTHON_UNAVAILABLE':'CITY_PYTHON_PROCESS_ERROR'));
   child.on('close',code=>{
    if(settled)return;if(code!==0){fail('CITY_PYTHON_EXIT');return;}
    try{const result=JSON.parse(output);if(result.error){const allowed=['CERTIFICATE_VERIFY_FAILED','ETIMEDOUT','ECONNRESET','OFFICIAL_RESPONSE_LIMIT','CITY_HTTPS_FAILED'];fail(allowed.includes(result.error)?result.error:'CITY_HTTPS_FAILED');return;}
     if(!Number.isInteger(result.status)||result.status<200||result.status>599||typeof result.body!=='string'||!Array.isArray(result.headers))throw Error('INVALID_RESPONSE');
     const body=Buffer.from(result.body,'base64');if(body.length>2*1024*1024){fail('OFFICIAL_RESPONSE_LIMIT');return;}
     const response=new Response([204,205,304].includes(result.status)?null:body,{status:result.status,headers:new Headers(result.headers)});settled=true;cleanup();resolve(response);
    }catch{fail('CITY_PYTHON_INVALID_RESPONSE');}
   });
   const headers=new Headers(init?.headers);
   child.stdin!.end(JSON.stringify({url:url.toString(),headers:{'User-Agent':'BusanRedevelopmentNewsMonitor/1.0','Accept-Encoding':'identity','Accept':headers.get('accept')||'text/html,application/xhtml+xml'}}));
  });
 };
}
export const pythonCityFetch=createPythonCityFetch();
