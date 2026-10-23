import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createImporterHandler,sha256} from '../supabase/functions/paper-review-import-temporary/importer-core.mjs';
const token='a'.repeat(43);
const bytes=new TextEncoder().encode('approved document bytes');
const spec={version:1,projectUrl:'https://cefaekvclooytgjkcqum.supabase.co',bucket:'paper-review-documents',datasetId:'human-1021-1559',
  tokenSha256:await sha256(new TextEncoder().encode(token)),expiresAt:'2026-10-23T12:00:00Z',
  objects:[{key:'human-1021-1559/human.pdf',size:bytes.length,sha256:await sha256(bytes),mime:'application/pdf'}]};
function setup(overrides={}){
  const calls=[];let credentialReads=0;
  const handler=createImporterHandler(spec,{now:()=>Date.parse('2026-10-23T10:00:00Z'),getRuntimeCredentials:()=>{credentialReads++;return {url:spec.projectUrl,serviceRoleKey:'test-runtime-key-never-return'};},
    fetch:async(url,init)=>{calls.push({url,init});return Response.json({Key:'uploaded'},{status:200});},...overrides});
  return {handler,calls,get credentialReads(){return credentialReads;}};
}
function request({method='POST',key=spec.objects[0].key,auth=token,body=bytes,length=bytes.length,contentType='application/octet-stream'}={}){
  const url=new URL(spec.projectUrl+'/functions/v1/paper-review-import-temporary');url.searchParams.set('key',key);
  return new Request(url,{method,headers:{'x-paper-import-token':auth,'content-length':String(length),'content-type':contentType},...(method==='GET'?{}:{body})});
}
test('importer denies unauthenticated, wrong method and expired calls before credential access',async()=>{
  const s=setup();assert.equal((await s.handler(request({auth:'b'.repeat(43)}))).status,401);
  assert.equal((await s.handler(request({method:'GET'}))).status,405);assert.equal(s.credentialReads,0);assert.equal(s.calls.length,0);
  const expired=setup({now:()=>Date.parse('2026-10-23T13:00:00Z')});assert.equal((await expired.handler(request())).status,410);assert.equal(expired.credentialReads,0);
});
test('immutable allowlist, declared/actual byte size and SHA reject unauthorized content',async()=>{
  const s=setup();
  for(const key of ['other/file.pdf','human-1021-1559/../secret','human-1021-1559/assets/s-not-listed','https://evil.test/file'])assert.equal((await s.handler(request({key}))).status,404);
  assert.equal((await s.handler(request({length:bytes.length+1}))).status,413);
  assert.equal((await s.handler(request({body:bytes.slice(1)}))).status,413);
  const wrong=Uint8Array.from(bytes);wrong[0]^=1;assert.equal((await s.handler(request({body:wrong}))).status,422);
  assert.equal((await s.handler(request({contentType:'text/plain'}))).status,415);
  assert.equal(s.credentialReads,0);assert.equal(s.calls.length,0);
});
test('approved bytes upload only to fixed Storage destination, never overwrite or return credential',async()=>{
  const s=setup();const r=await s.handler(request());assert.equal(r.status,201);
  const result=await r.json();assert.equal(result.sha256,spec.objects[0].sha256);assert.equal(result.size,bytes.length);
  assert.equal(JSON.stringify(result).includes('test-runtime-key'),false);
  assert.equal(s.calls.length,1);assert.equal(s.calls[0].url,spec.projectUrl+'/storage/v1/object/paper-review-documents/human-1021-1559/human.pdf');
  assert.equal(s.calls[0].init.method,'POST');assert.equal(s.calls[0].init.headers['x-upsert'],'false');assert.equal(s.calls[0].init.redirect,'error');assert.equal(s.calls[0].init.headers['content-type'],'application/pdf');
  assert.deepEqual(s.calls[0].init.body,bytes);assert.equal(s.credentialReads,1);
});
test('runtime mismatch, duplicate and upstream failure produce bounded safe responses',async()=>{
  const mismatch=setup({getRuntimeCredentials:()=>({url:'https://other.supabase.co',serviceRoleKey:'secret'})});assert.equal((await mismatch.handler(request())).status,503);assert.equal(mismatch.calls.length,0);
  const duplicate=setup({fetch:async()=>Response.json({statusCode:'409',error:'Duplicate'},{status:400})});assert.equal((await duplicate.handler(request())).status,409);
  const failed=setup({fetch:async()=>Response.json({credential:'secret-value',stack:'private upstream'},{status:500})});const response=await failed.handler(request());assert.equal(response.status,502);assert.doesNotMatch(await response.text(),/secret-value|private upstream/);
});
test('malformed spec fails closed instead of creating a generic proxy',()=>{
  for(const changed of [{projectUrl:'https://evil.test'},{bucket:'other-bucket'},{expiresAt:'unknown'},{objects:[{...spec.objects[0],key:'../../secret'}]},{objects:[spec.objects[0],spec.objects[0]]}])assert.throws(()=>createImporterHandler({...spec,...changed},{}));
});
