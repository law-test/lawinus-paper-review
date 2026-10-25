import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {handleQuestionEnter} from '../src/ai-mingyu-enter.ts';
import {AI_MINGYU_ENABLED} from '../src/ai-mingyu-availability.ts';

const require=createRequire(import.meta.url),typed='인가 전에 일부만 납부한 경우에도 적용되나요?';
function harness(kind,busy=false){
 const states=[],calls=[],module={exports:{}};
 let source=readFileSync(new URL(`../src/ai-mingyu-${kind}.tsx`,import.meta.url),'utf8');
 source=source.replace("[question,setQuestion]=useState('')",'[question,setQuestion]=useState(__typed)')
  .replace('useState<Status|null>(null)','useState<Status|null>({connected:true})');
 if(busy)source=source.replace('[busy,setBusy]=useState(false)','[busy,setBusy]=useState(true)');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,__typed:typed,sessionStorage:{getItem:()=> 'fixture'},crypto:{randomUUID:()=> 'test-request'},AbortController,Date,require:id=>{
  if(id==='react')return {...React,useState:initial=>{const i=states.length;states.push(typeof initial==='function'?initial():initial);return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},useEffect(){},useRef:value=>({current:value}),useMemo:fn=>fn()};
  if(id==='./ai-mingyu-enter')return {handleQuestionEnter};
  if(id==='./ai-mingyu-client')return {MINGYU_SESSION_KEY:'fixture',mingyuRequest:async(path,_token,body)=>{calls.push({path,body});return {answer:{summary:'fixture',sections:[],citations:[]},source:'model'};}};
  if(id==='./ai-mingyu-level')return {readAnswerLevel:()=> 'undergraduate',saveAnswerLevel(){},answerLevels:[],levelLabel:()=> '법학사'};
  if(id==='./ai-mingyu-public-answers.json')return {default:{items:[],verifiedOn:'2026-10-24'}};
  if(id==='./ai-mingyu-public-model')return {publicAnswerIndex:()=>({exact:()=>null,search:()=>[]})};
  if(id==='./thesis-faq-model')return {filterFaq:items=>items};
  if(id.startsWith('.'))return {__esModule:true,default:()=>null};return require(id);
 }});
 const tree=module.exports.default({onOwner(){},renderAnswer(){return null;}}),nodes=[];
 function visit(node){if(!node||typeof node!=='object')return;nodes.push(node);React.Children.forEach(node.props?.children,visit);}visit(tree);
 const textarea=nodes.find(node=>node.type==='textarea');assert.ok(textarea);
 return {textarea,states,calls,sent:()=>kind==='private'?calls.filter(c=>c.path==='/ask').map(c=>c.body.question):states.flatMap(s=>Array.isArray(s)?s.filter(x=>x?.question).map(x=>x.question):[])};
}
function key(h,patch={}){let prevented=0;h.textarea.props.onKeyDown({key:'Enter',shiftKey:false,altKey:false,repeat:false,nativeEvent:{isComposing:false,keyCode:13},preventDefault(){prevented++;},...patch});return prevented;}

for(const kind of ['public','private']){
 test(`${kind}: Enter sends the exact draft and Shift+Enter preserves a newline`,()=>{
  const h=harness(kind);assert.equal(key(h,{shiftKey:true}),0);assert.deepEqual(h.sent(),[]);assert.ok(h.states.includes(typed));
  assert.equal(key(h),1);assert.deepEqual(h.sent(),[typed]);
 });
 test(`${kind}: composition state, native composition and IME 229 never send`,()=>{
  for(const patch of [{nativeEvent:{isComposing:true,keyCode:13}},{nativeEvent:{isComposing:false,keyCode:229}}]){const h=harness(kind);assert.equal(key(h,patch),0);assert.deepEqual(h.sent(),[]);assert.ok(h.states.includes(typed));}
  const h=harness(kind);h.textarea.props.onCompositionStart();assert.equal(key(h),0);assert.deepEqual(h.sent(),[]);
  h.textarea.props.onCompositionEnd();assert.equal(key(h),1);assert.deepEqual(h.sent(),[typed]);
 });
 test(`${kind}: a held Enter or pending answer cannot submit a second request`,()=>{
  const repeat=harness(kind);assert.equal(key(repeat,{repeat:true}),1);assert.deepEqual(repeat.sent(),[]);
  const pending=harness(kind,true);assert.equal(key(pending),1);assert.deepEqual(pending.sent(),[]);assert.ok(pending.states.includes(typed));
 });
}
test('other keys, Alt+Enter and a previously handled event retain native behavior',()=>{
 for(const patch of [{key:'a'},{altKey:true},{defaultPrevented:true}]){let sends=0,prevented=0;handleQuestionEnter({key:'Enter',shiftKey:false,preventDefault(){prevented++;},...patch},()=>sends++);assert.equal(sends,0);assert.equal(prevented,0);}
});
test('Enter support does not activate the paused service',()=>assert.equal(AI_MINGYU_ENABLED,false));
