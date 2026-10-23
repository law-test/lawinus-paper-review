// Explicit live verification only: node scripts/verify-live-memos.mjs --run
// Creates two temporary anonymous users and three short test notes. All created
// notes are deleted in finally; sessions are revoked. Tokens are never persisted.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';
if(process.argv.length!==3||process.argv[2]!=='--run')throw new Error('Pass --run to perform explicit live Auth and memo verification.');
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(await readFile(path.join(base,'public','config.json'),'utf8'));
if(config.supabaseUrl!=='https://cefaekvclooytgjkcqum.supabase.co'||config.datasetId!=='human-1021-1559')throw new Error('Unexpected target project/dataset.');
const runId=new Date().toISOString().replace(/[^0-9]/g,'');
const report={runId,projectUrl:config.supabaseUrl,datasetId:config.datasetId,startedAt:new Date().toISOString(),checks:[],testUsers:[],createdNotes:[],cleanup:[],anonymousSignInsEnabled:false,complete:false};
const work=path.join(base,'work');await mkdir(work,{recursive:true});
const save=()=>writeFile(path.join(work,'live-memo-verification.private.json'),JSON.stringify(report,null,2)+'\n',{encoding:'utf8',mode:0o600});
const makeClient=()=>createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(45000)})}});
const clients={A:makeClient(),B:makeClient(),public:makeClient()};
const owned=new Map();
const rpc=async(client,name,args)=>{
  const {data,error}=await client.rpc(name,args);
  if(error)throw Object.assign(new Error(`RPC ${name} failed (${error.code||'unknown'}).`),{code:error.code});
  if(data===null)throw new Error(`RPC ${name} returned no result.`);
  return data;
};
const list=async(client)=>rpc(client,'paper_review_list_notes',{p_dataset_id:config.datasetId,p_status:null,p_export:false});
const expectCode=async(promise,code)=>{try{await promise;}catch(error){assert.equal(error.code,code);return;}throw new Error(`Expected ${code}; request unexpectedly succeeded.`);};
const noteArgs=(id,input)=>({p_dataset_id:config.datasetId,p_id:id,p_input:input});
const create=async(owner,input)=>{
  const result=await rpc(clients[owner],'paper_review_create_note',{p_dataset_id:config.datasetId,p_input:input});
  owned.set(result.note.id,{owner,revision:result.note.revision});report.createdNotes.push({id:result.note.id,owner,visibility:result.note.visibility});await save();return result.note;
};
async function check(name,fn){await fn();report.checks.push({name,passed:true});await save();}
try{
  await check('two real anonymous Auth sessions',async()=>{
    for(const owner of ['A','B']){
      const {data,error}=await clients[owner].auth.signInAnonymously();
      if(error||!data.user||!data.session)throw new Error(`Anonymous sign-in ${owner} failed (${error?.code||'no-session'}).`);
      assert.equal(data.user.is_anonymous,true);report.testUsers.push({owner,id:data.user.id});await save();
    }
    assert.notEqual(report.testUsers[0].id,report.testUsers[1].id);report.anonymousSignInsEnabled=true;
  });
  let aPrivate,aShared,bPrivate;
  await check('private default, explicit sharing and baseline linkage',async()=>{
    aPrivate=await create('A',{text:`일시 검증용 메모 (자동 삭제) ${runId} A private`,anchorType:'footnote',noteId:'fn-192',page:183});
    aShared=await create('A',{text:`일시 검증용 메모 (자동 삭제) ${runId} A shared`,visibility:'shared'});
    bPrivate=await create('B',{text:`일시 검증용 메모 (자동 삭제) ${runId} B private`});
    assert.equal(aPrivate.visibility,'private');assert.equal(aPrivate.datasetId,config.datasetId);assert.equal(aPrivate.page,183);assert.equal(aPrivate.editable,true);assert.equal(aShared.visibility,'shared');
    for(const row of [aPrivate,aShared,bPrivate])assert.equal('userId'in row||'ownerId'in row||'owner_id'in row,false);
  });
  await check('public and B cannot see A private; shared read has no edit permission',async()=>{
    for(const client of [clients.public,clients.B]){
      const rows=(await list(client)).notes;assert.equal(rows.some(n=>n.id===aPrivate.id),false);
      const shared=rows.find(n=>n.id===aShared.id);assert.ok(shared);assert.equal(shared.editable,false);
    }
    assert.equal((await list(clients.A)).notes.some(n=>n.id===bPrivate.id),false);
    assert.equal((await list(clients.B)).notes.find(n=>n.id===bPrivate.id).editable,true);
  });
  await check('B cannot modify/delete A private or shared notes',async()=>{
    for(const id of [aPrivate.id,aShared.id]){
      await expectCode(rpc(clients.B,'paper_review_update_note',noteArgs(id,{revision:1,text:'ownership rejection test'})),'PT404');
      await expectCode(rpc(clients.B,'paper_review_delete_note',noteArgs(id,{revision:1})),'PT404');
    }
  });
  await check('anonymous table access and writes blocked',async()=>{
    for(const client of [clients.public,clients.A]){
      const {error}=await client.from('paper_review_notes').select('id').limit(1);assert.ok(error);assert.equal(error.code,'42501');
    }
    await expectCode(rpc(clients.public,'paper_review_create_note',{p_dataset_id:config.datasetId,p_input:{text:'unauthorized write test'}}),'42501');
  });
  await check('owner update and stale revision conflict',async()=>{
    const updated=(await rpc(clients.A,'paper_review_update_note',noteArgs(aPrivate.id,{revision:1,text:`일시 검증용 메모 (자동 삭제) ${runId} A changed`,status:'resolved'}))).note;
    owned.set(aPrivate.id,{owner:'A',revision:updated.revision});assert.equal(updated.revision,2);assert.equal(updated.status,'resolved');
    await expectCode(rpc(clients.A,'paper_review_update_note',noteArgs(aPrivate.id,{revision:1,text:'stale test'})),'PT409');
    await expectCode(rpc(clients.A,'paper_review_delete_note',noteArgs(aPrivate.id,{revision:1})),'PT409');
  });
  await check('server rejects out-of-baseline footnote and owner injection',async()=>{
    for(const input of [{text:'invalid note',noteId:'fn-247'},{text:'invalid owner',owner_id:report.testUsers[1].id}])await expectCode(rpc(clients.A,'paper_review_create_note',{p_dataset_id:config.datasetId,p_input:input}),'PT400');
  });
  await check('public export excludes private notes',async()=>{
    const result=await rpc(clients.public,'paper_review_list_notes',{p_dataset_id:config.datasetId,p_status:null,p_export:true});
    assert.equal(result.truncated,false);assert.equal(result.notes.some(n=>n.id===aPrivate.id||n.id===bPrivate.id),false);assert.ok(result.notes.some(n=>n.id===aShared.id));
  });
  report.complete=true;
}catch(error){report.error=error instanceof Error?error.message:'Verification failed';process.exitCode=1;}
finally{
  for(const [id,record] of owned){
    try{
      // Re-read current owner-visible revision before cleanup, even after a failed assertion.
      const row=(await list(clients[record.owner])).notes.find(n=>n.id===id);
      if(row)await rpc(clients[record.owner],'paper_review_delete_note',noteArgs(id,{revision:row.revision}));
      report.cleanup.push({id,deleted:true});
    }catch{report.cleanup.push({id,deleted:false});report.complete=false;process.exitCode=1;}
  }
  try{
    const remaining=(await list(clients.public)).notes.filter(n=>report.createdNotes.some(test=>test.id===n.id));
    if(remaining.length){report.cleanupPublicRemainders=remaining.map(n=>n.id);report.complete=false;process.exitCode=1;}
  }catch{report.cleanupPublicCheckFailed=true;report.complete=false;process.exitCode=1;}
  for(const owner of ['A','B']){
    try{const {error}=await clients[owner].auth.signOut({scope:'global'});if(error)throw error;report[`session${owner}Revoked`]=true;}catch{report[`session${owner}Revoked`]=false;report.complete=false;process.exitCode=1;}
  }
  report.finishedAt=new Date().toISOString();await save();
  console.log(JSON.stringify({complete:report.complete,anonymousSignInsEnabled:report.anonymousSignInsEnabled,checksPassed:report.checks.length,
    notesCreated:report.createdNotes.length,notesDeleted:report.cleanup.filter(n=>n.deleted).length,
    sessionARevoked:report.sessionARevoked,sessionBRevoked:report.sessionBRevoked,
    tokensSaved:false,testUserIdsStoredOnlyInIgnoredReport:true,...(report.error?{error:report.error}:{})}));
}
