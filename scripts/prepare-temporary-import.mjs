import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const work=path.join(base,'work');
const folder=path.join(base,'supabase','functions','paper-review-import-temporary');
const plan=JSON.parse(await readFile(path.join(work,'upload-plan.private.json'),'utf8'));
if(plan.datasetId!=='human-1021-1559'||!Array.isArray(plan.items)||plan.items.length!==224)throw new Error('Expected the authorized 224-object human-1021-1559 plan.');
const seen=new Set();
const objects=plan.items.map(item=>{
  if(!/^human-1021-1559\/(human\.pdf|manifest\.json|profile\.json|assets\/s-[A-Za-z0-9_-]{1,100})$/.test(item.storageKey)||seen.has(item.storageKey))throw new Error('Invalid/duplicate storage key.');
  seen.add(item.storageKey);
  if(!Number.isSafeInteger(item.size)||item.size<1||item.size>50*1024*1024||!/^[a-f0-9]{64}$/.test(item.sha256))throw new Error('Invalid size/SHA256.');
  if(!['application/pdf','application/json','text/plain','text/plain; charset=utf-8'].includes(item.mime))throw new Error('Unapproved content type.');
  return {key:item.storageKey,size:item.size,sha256:item.sha256,mime:item.mime};
});
const token=randomBytes(32).toString('base64url');
const projectUrl='https://cefaekvclooytgjkcqum.supabase.co';
const expiresAt=new Date(Date.now()+4*60*60*1000).toISOString();
const spec={version:1,projectUrl,bucket:'paper-review-documents',datasetId:plan.datasetId,
  tokenSha256:createHash('sha256').update(token).digest('hex'),expiresAt,objects};
const raw=JSON.stringify(spec,null,2)+'\n';
await mkdir(folder,{recursive:true});await mkdir(work,{recursive:true});
await writeFile(path.join(folder,'allowlist.json'),raw,'utf8');
await writeFile(path.join(work,'temporary-import.private.json'),JSON.stringify({
  version:1,token,projectUrl,bucket:spec.bucket,datasetId:spec.datasetId,expiresAt,
  functionUrl:projectUrl+'/functions/v1/paper-review-import-temporary',
  allowlistSha256:createHash('sha256').update(raw).digest('hex'),
},null,2)+'\n',{encoding:'utf8',mode:0o600});
console.log(JSON.stringify({ready:true,objects:objects.length,bytes:objects.reduce((n,x)=>n+x.size,0),expiresAt,tokenStoredOnlyInIgnoredFile:true}));
