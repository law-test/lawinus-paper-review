// No key, filesystem access, generic proxy, delete or overwrite capability is exposed.
const headers = { 'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff' };
const reply = (status, value) => new Response(JSON.stringify(value), {status,headers});
export async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function equalHex(a,b) {
  if(a.length!==64 || b.length!==64)return false;
  let mismatch=0;for(let i=0;i<64;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);
  return mismatch===0;
}
async function readExactBody(request,size) {
  if(!request.body)throw new Error('size');
  const bytes=new Uint8Array(size);const reader=request.body.getReader();let offset=0;
  try{
    while(true){const chunk=await reader.read();if(chunk.done)break;
      if(offset+chunk.value.byteLength>size){await reader.cancel();throw new Error('size');}
      bytes.set(chunk.value,offset);offset+=chunk.value.byteLength;
    }
  }finally{reader.releaseLock();}
  if(offset!==size)throw new Error('size');
  return bytes;
}
export function createImporterHandler(spec,deps) {
  if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(spec.projectUrl)||spec.bucket!=='paper-review-documents'||
      spec.datasetId!=='human-1021-1559'||!/^[a-f0-9]{64}$/.test(spec.tokenSha256)||!Number.isFinite(Date.parse(spec.expiresAt))||
      !Array.isArray(spec.objects))throw new Error('Invalid immutable importer specification');
  const keys=new Set();
  for(const item of spec.objects){
    if(!/^human-1021-1559\/(human\.pdf|manifest\.json|profile\.json|assets\/s-[A-Za-z0-9_-]{1,100})$/.test(item.key)||keys.has(item.key)||
        !Number.isSafeInteger(item.size)||item.size<1||item.size>50*1024*1024||!/^[a-f0-9]{64}$/.test(item.sha256)||
        !['application/pdf','application/json','text/plain','text/plain; charset=utf-8'].includes(item.mime))throw new Error('Invalid immutable object authorization');
    keys.add(item.key);
  }
  const allowed=new Map(spec.objects.map(item=>[item.key,Object.freeze({...item})]));
  const now=deps.now??(()=>Date.now());
  return async request=>{
    if(request.method!=='POST')return reply(405,{error:'POST only'});
    if(now()>Date.parse(spec.expiresAt))return reply(410,{error:'Import window expired'});
    const token=request.headers.get('x-paper-import-token')??'';
    if(!/^[A-Za-z0-9_-]{43,128}$/.test(token)||!equalHex(await sha256(new TextEncoder().encode(token)),spec.tokenSha256))return reply(401,{error:'Unauthorized'});
    const url=new URL(request.url);
    if([...url.searchParams.keys()].some(key=>key!=='key')||url.searchParams.getAll('key').length!==1)return reply(400,{error:'Exactly one object key required'});
    const key=url.searchParams.get('key');const item=allowed.get(key);
    if(!item)return reply(404,{error:'Object not authorized'});
    if(request.headers.get('content-length')!==String(item.size))return reply(413,{error:'Unexpected byte length'});
    if(request.headers.get('content-type')!=='application/octet-stream')return reply(415,{error:'Raw bytes required'});
    let bytes;
    try{bytes=await readExactBody(request,item.size);}catch{return reply(413,{error:'Unexpected byte length'});}
    if(!equalHex(await sha256(bytes),item.sha256))return reply(422,{error:'SHA256 mismatch'});
    // Environment credentials are read only AFTER all authorization/content checks.
    let credentials;try{credentials=deps.getRuntimeCredentials();}catch{return reply(503,{error:'Importer configuration unavailable'});}
    if(credentials.url!==spec.projectUrl || !credentials.serviceRoleKey)return reply(503,{error:'Importer configuration unavailable'});
    const target=spec.projectUrl+'/storage/v1/object/'+encodeURIComponent(spec.bucket)+'/'+item.key.split('/').map(encodeURIComponent).join('/');
    let result;
    try{
      result=await deps.fetch(target,{
        method:'POST',redirect:'error',signal:AbortSignal.timeout(120000),
        headers:{'apikey':credentials.serviceRoleKey,'authorization':'Bearer '+credentials.serviceRoleKey,
          'content-type':item.mime,'x-upsert':'false','cache-control':'max-age=3600'},
        body:bytes,
      });
    }catch{return reply(502,{error:'Storage upload failed; verify object before retrying'});}
    if(!result.ok){
      let duplicate=result.status===409;
      if(result.status===400){try{const body=await result.json();duplicate=String(body.statusCode)==='409'||body.error==='Duplicate'||body.error==='ResourceAlreadyExists';}catch{}}
      return duplicate?reply(409,{error:'Object already exists; verify public SHA256'}):reply(502,{error:'Storage rejected upload',storageStatus:result.status});
    }
    return reply(201,{created:true,key:item.key,size:item.size,sha256:item.sha256});
  };
}
