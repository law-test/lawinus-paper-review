// Explicit Auth/REST verification. No production document revision is created.
import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
if(process.argv[2]!=='--run')throw new Error('Pass --run for explicit hosted Auth/REST verification.');
const config=JSON.parse(await readFile(new URL('../public/config.json',import.meta.url),'utf8'));
assert.equal(config.supabaseUrl,'https://cefaekvclooytgjkcqum.supabase.co');assert.equal(config.datasetId,'human-1021-1559');
const make=()=>createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const publicClient=make(),visitor=make();const report={at:new Date().toISOString(),checks:[],productionWrites:0};
const args={p_dataset_id:config.datasetId,p_kind:'paragraph',p_target_id:'P999999',p_expected_revision:0,p_text:'Uncatalogued test must be rejected',p_reason:'',p_restore_revision:null};
try{
 const before=await publicClient.rpc('paper_review_shared_list',{p_dataset_id:config.datasetId});assert.ifError(before.error);
 const denied=await publicClient.rpc('paper_review_shared_save',args);assert.equal(denied.error?.code,'42501');report.checks.push('unauthenticated write blocked');
 const auth=await visitor.auth.signInAnonymously();assert.ifError(auth.error);assert.equal(auth.data.user.is_anonymous,true);report.testUserId=auth.data.user.id;report.checks.push('real anonymous Auth enabled');
 const unlisted=await visitor.rpc('paper_review_shared_save',args);assert.equal(unlisted.error?.code,'PT404');report.checks.push('authenticated write reaches allowlist and rejects unknown target');
 const history=await publicClient.rpc('paper_review_shared_history',{p_dataset_id:config.datasetId,p_kind:'footnote',p_target_id:'fn-001'});assert.ifError(history.error);assert.ok(history.data.original.text);report.checks.push('public history and immutable original readable');
 const raw=await visitor.schema('paper_review_private').from('edit_catalog').select('target_id').limit(1);assert.equal(raw.error?.code,'PGRST106');report.checks.push('private schema not exposed');
 const after=await publicClient.rpc('paper_review_shared_list',{p_dataset_id:config.datasetId});assert.ifError(after.error);assert.deepEqual(after.data,before.data);report.checks.push('production revisions unchanged');
 report.complete=true;
}catch(e){report.error=e.message;report.complete=false;process.exitCode=1;}
finally{
 const out=await visitor.auth.signOut({scope:'global'});report.sessionRevoked=!out.error;
 if(out.error){report.complete=false;process.exitCode=1;}
 await writeFile(new URL('../work/live-shared-edits-verification.private.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({complete:report.complete,checks:report.checks,productionWrites:0,sessionRevoked:report.sessionRevoked,error:report.error}));
}
