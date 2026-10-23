import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const work=path.join(base,'work');
const plan=JSON.parse(await readFile(path.join(work,'upload-plan.private.json'),'utf8'));
const settings=JSON.parse(await readFile(path.join(work,'temporary-import.private.json'),'utf8'));
const rawSpec=await readFile(path.join(base,'supabase','functions','paper-review-import-temporary','allowlist.json'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
if(digest(rawSpec)!==settings.allowlistSha256)throw new Error('Importer allowlist changed after token preparation.');
const spec=JSON.parse(rawSpec);
if(settings.projectUrl!=='https://cefaekvclooytgjkcqum.supabase.co'||settings.bucket!=='paper-review-documents'||settings.datasetId!=='human-1021-1559')throw new Error('Unexpected import destination.');
if(settings.functionUrl!==settings.projectUrl+'/functions/v1/paper-review-import-temporary')throw new Error('Unexpected function route.');
const approved=new Map(spec.objects.map(x=>[x.key,x]));
const items=[...plan.items.filter(x=>x.id!=='manifest'),...plan.items.filter(x=>x.id==='manifest')];
if(items.length!==224||items.at(-1).id!=='manifest'||new Set(items.map(x=>x.storageKey)).size!==224)throw new Error('Expected 224 unique objects, with manifest last.');
for(const item of items){const match=approved.get(item.storageKey);if(!match||match.size!==item.size||match.sha256!==item.sha256||match.mime!==item.mime)throw new Error('Plan differs from immutable upload authorization.');}
const args=new Set(process.argv.slice(2));
if([...args].some(x=>!['--run','--verify-only','--verify-disabled'].includes(x)))throw new Error('Unknown argument.');
if(args.has('--verify-disabled')){
  const response=await fetch(settings.functionUrl,{method:'POST',redirect:'error',headers:{'content-type':'application/octet-stream'},body:new Uint8Array(),signal:AbortSignal.timeout(30000)});
  if(response.status!==410)throw new Error('Importer did not return disabled status 410.');
  console.log(JSON.stringify({disabled:true,status:410}));process.exit(0);
}
if(!args.has('--run')&&!args.has('--verify-only')){
  console.log(JSON.stringify({dryRun:true,objects:items.length,bytes:items.reduce((n,x)=>n+x.size,0),destination:settings.projectUrl,expiresAt:settings.expiresAt,run:'Pass --run to upload or --verify-only for public SHA checks.'}));process.exit(0);
}
if(args.has('--run')&&Date.now()>Date.parse(settings.expiresAt))throw new Error('Temporary import window expired.');
const output={startedAt:new Date().toISOString(),datasetId:settings.datasetId,projectUrl:settings.projectUrl,mode:args.has('--verify-only')?'verify-only':'upload',objects:[]};
async function record(){await writeFile(path.join(work,'temporary-import-results.private.json'),JSON.stringify(output,null,2)+'\n','utf8');}
async function verifyRemote(item){
  const url=settings.projectUrl+'/storage/v1/object/public/'+settings.bucket+'/'+item.storageKey.split('/').map(encodeURIComponent).join('/')+'?verify='+item.sha256;
  const response=await fetch(url,{redirect:'error',headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(120000)});
  if(response.status===404)return false;
  if(response.status===400){let e;try{e=await response.json();}catch{}if(String(e?.statusCode)==='404'||e?.error==='not_found')return false;throw new Error(`Public verification rejected (${response.status}).`);}
  if(!response.ok||!response.body)throw new Error(`Public verification unavailable (${response.status}).`);
  const advertised=response.headers.get('content-length');if(advertised&&Number(advertised)!==item.size)throw new Error('Existing remote object length differs; nothing overwritten.');
  const hash=createHash('sha256');let bytes=0;
  for await(const chunk of response.body){bytes+=chunk.length;if(bytes>item.size)throw new Error('Existing remote object is oversized; nothing overwritten.');hash.update(chunk);}
  if(bytes!==item.size||hash.digest('hex')!==item.sha256)throw new Error('Existing remote object SHA256 differs; nothing overwritten.');
  return true;
}
try{
  for(const [index,item] of items.entries()){
    // Confirm local bytes even when a matching public copy already exists.
    const bytes=await readFile(item.path);if(bytes.length!==item.size||digest(bytes)!==item.sha256)throw new Error(`Local file changed: ${item.id}`);
    let state='existing-verified';
    if(!await verifyRemote(item)){
      if(args.has('--verify-only'))throw new Error(`Public object missing: ${item.id}`);
      const url=new URL(settings.functionUrl);url.searchParams.set('key',item.storageKey);
      let response;
      try{response=await fetch(url,{method:'POST',redirect:'error',headers:{
        'x-paper-import-token':settings.token,'content-type':'application/octet-stream','content-length':String(item.size)},
        body:bytes,signal:AbortSignal.timeout(150000)});}catch{
        if(!await verifyRemote(item))throw new Error(`Upload transport failed for ${item.id}; rerun safely after checking connection.`);
        state='upload-response-lost-public-verified';
      }
      if(response){
        if(!response.ok&&response.status!==409)throw new Error(`Importer rejected ${item.id} (${response.status}); no overwrite attempted.`);
        if(!await verifyRemote(item))throw new Error(`Upload result not publicly verifiable: ${item.id}`);
        state=response.status===409?'concurrent-existing-verified':'uploaded-verified';
      }
    }
    output.objects.push({id:item.id,key:item.storageKey,size:item.size,sha256:item.sha256,state});
    await record();
    console.log(JSON.stringify({completed:index+1,total:items.length,id:item.id,state}));
  }
  output.completedAt=new Date().toISOString();output.verifiedBytes=items.reduce((n,x)=>n+x.size,0);output.complete=true;await record();
  console.log(JSON.stringify({complete:true,verifiedObjects:output.objects.length,verifiedBytes:output.verifiedBytes,disableImporterNow:true}));
}catch(error){
  output.complete=false;output.failedAt=new Date().toISOString();output.error=error instanceof Error?error.message:'Import failed';await record();
  console.error(output.error);process.exitCode=1;
}
