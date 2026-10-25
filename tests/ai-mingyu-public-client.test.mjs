import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as levels from '../src/ai-mingyu-level.ts';
const source=readFileSync(new URL('../src/ai-mingyu-public-client.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const requestId='12345678-1234-4123-8123-123456789abc',deviceId='87654321-4321-4321-8321-abcdef123456';
const answer={summary:'검토 결과',sections:[{kind:'author_interpretation',title:'필자 해석',text:'필자의 해석이며 법원의 확정된 결론과 구별합니다.',citationIds:['P1']}],citations:[{id:'P1',kind:'paper',label:'논문 근거',href:'https://paper.lawinus.org/?proposal=P0979'}],edition:'v104 문안모형',sourceWarning:'실제 적용원고 v102'};
const valid=()=>({answer:structuredClone(answer),level:'doctoral',source:'model',model:'gpt-model',requestId,private:false,elapsedMs:55,generatedAt:'2026-10-25T00:00:00Z',evidenceDate:'2026-10-24'});
function setup(result,status=200,enabled=true){
 const requests=[],reads=[],writes=[],values=new Map(),module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,URL,Set,Map,AbortController,setTimeout,clearTimeout,Date,crypto:{randomUUID:()=>deviceId},localStorage:{getItem:key=>{reads.push(key);return values.get(key)||null;},setItem:(key,value)=>{writes.push({key,value});values.set(key,value);}},sessionStorage:new Proxy({},{get(){throw Error('private storage touched');}}),fetch:async(url,options)=>{requests.push({url,options});return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(result)};},require:id=>{if(id==='./ai-mingyu-level')return levels;if(id==='./ai-mingyu-availability')return {AI_MINGYU_ENABLED:enabled,AI_MINGYU_PAUSED_MESSAGE:'준비 중입니다. 논문 FAQ를 이용해 주세요.'};throw Error('Unexpected runtime import '+id);}});
 return {...module.exports,requests,reads,writes,values};
}
test('public status does not touch device or private storage and an absent service stays in FAQ mode',async()=>{
 for(const [body,status,expected] of [[{active:true,generationEnabled:true},200,true],[{active:false,generationEnabled:false},200,false],[{error:'Not found'},404,false],[{},200,false]]){
  const h=setup(body,status);assert.equal(await h.publicServiceStatus(),expected);assert.deepEqual(h.reads,[]);assert.deepEqual(h.writes,[]);
  assert.equal(h.requests[0].url,h.PUBLIC_MINGYU_ENDPOINT+'/status');assert.equal(h.requests[0].options.credentials,'omit');assert.equal(h.requests[0].options.headers.Authorization,undefined);
 }
});
test('public ask sends only question, level and opaque IDs, and validates metadata',async()=>{
 const h=setup({...valid(),quota:123,secret:'not-to-be-returned'});const result=await h.askPublicMingyu(' 질문 ', 'doctoral',requestId);
 assert.deepEqual(JSON.parse(h.requests[0].options.body),{question:'질문',level:'doctoral',deviceId,requestId});
 assert.deepEqual(Object.keys(result).sort(),['answer','elapsedMs','evidenceDate','generatedAt','level','model','source']);
 assert.equal(h.requests[0].options.credentials,'omit');assert.equal(h.requests[0].options.referrerPolicy,'no-referrer');
 assert.ok(h.reads.every(key=>key==='lawinus.mingyu.public-device.v1'));assert.equal(h.writes.length,1);
 await h.askPublicMingyu('질문 2','doctoral',requestId);assert.equal(h.writes.length,1);
});
test('invalid question and request ID are rejected before network or storage access',async()=>{
 for(const [question,id] of [['',requestId],['x'.repeat(1801),requestId],['질문','invalid']]){
  const h=setup(valid());await assert.rejects(()=>h.askPublicMingyu(question,'doctoral',id));assert.equal(h.requests.length,0);assert.equal(h.reads.length,0);
 }
});
test('unsafe or credential-bearing evidence URLs and invalid legal categories are rejected',()=>{
 const h=setup(valid());
 for(const href of ['http://paper.lawinus.org/','javascript:alert(1)','https://user:password@paper.lawinus.org/','/relative']){const bad=structuredClone(answer);bad.citations[0].href=href;assert.throws(()=>h.validatePublicAnswer(bad));}
 for(const update of [a=>a.sections[0].kind='accepted_law',a=>a.sections[0].citationIds=['unprovided'],a=>a.citations.push({...a.citations[0]}),a=>a.citations[0].kind='private_note']){const bad=structuredClone(answer);update(bad);assert.throws(()=>h.validatePublicAnswer(bad));}
});
test('public responses cannot substitute another request, level, or a private response',async()=>{
 for(const patch of [{requestId:deviceId},{private:true},{level:'high-school'},{source:'reviewed_model'}]){
  const h=setup({...valid(),...patch});await assert.rejects(()=>h.askPublicMingyu('질문','doctoral',requestId));
 }
});
test('a device-scoped cached answer keeps its original source, model and generation time',async()=>{
 const data={...valid(),source:'cache',cacheHit:true,generated:false},h=setup(data);
 const result=await h.askPublicMingyu('같은 질문','doctoral',requestId);
 assert.equal(result.source,'cache');assert.equal(result.model,data.model);assert.equal(result.generatedAt,data.generatedAt);assert.equal(result.level,'doctoral');assert.equal(result.answer.sections[0].text,data.answer.sections[0].text);
});
test('server usage counts and raw error text are not exposed to visitors',async()=>{
 const h=setup({code:'temporarily_limited',error:'quota 123 secret value',limit:123},429);
 await assert.rejects(()=>h.askPublicMingyu('질문','doctoral',requestId),error=>!error.message.includes('123')&&!error.message.includes('secret')&&error.message.includes('잠시 후'));
});

test('a clarification-only limitations response can omit citations without implying a legal conclusion',()=>{
 const h=setup(valid()),clarification={summary:'사실관계를 먼저 알려 주세요.',sections:[{kind:'limitations',title:'필요한 사실관계',text:'매각대금 납부일과 인가일을 각각 알려 주세요.',citationIds:[]}],citations:[]};
 assert.equal(h.validatePublicAnswer(clarification).sections[0].kind,'limitations');
 const unsupported=structuredClone(clarification);unsupported.sections[0].kind='current_law';assert.throws(()=>h.validatePublicAnswer(unsupported));
 const mixed=structuredClone(answer);mixed.sections.push(clarification.sections[0]);assert.equal(h.validatePublicAnswer(mixed).sections.length,2);
});
test('the paused service performs no status or question request and touches no browser identity',async()=>{
 const h=setup(valid(),200,false);assert.equal(await h.publicServiceStatus(),false);
 await assert.rejects(()=>h.askPublicMingyu('질문','doctoral',requestId),/준비 중/);
 assert.equal(h.requests.length,0);assert.equal(h.reads.length,0);assert.equal(h.writes.length,0);
});
