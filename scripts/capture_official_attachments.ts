import fs from 'node:fs';import {downloadAttachment} from '../src/attachments/attachmentReader';
const manifest=JSON.parse(fs.readFileSync('evidence/attachment-real/manifest.json','utf8'));
for(const [n,url] of ['https://www.busan.go.kr/nbgosi/download?fileId=F26100214385628835&seq=0','https://www.busan.go.kr/nbgosi/download?fileId=F26100214385628835&seq=1'].entries()){const b=await downloadAttachment(url);const file=`official-${n+1}.bin`;fs.writeFileSync('evidence/attachment-real/'+file,b);manifest.push({file,url,bytes:b.length,signature:b.subarray(0,8).toString('hex')});}
fs.writeFileSync('evidence/attachment-real/manifest.json',JSON.stringify(manifest,null,2));console.log(manifest.slice(-2));
