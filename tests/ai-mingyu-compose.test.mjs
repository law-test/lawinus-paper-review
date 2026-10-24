import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';

const require=createRequire(import.meta.url);
const typed='인가 전에 지급했지만 일부 금액만 낸 경우에는 어떻게 되나요?';
const suggestions=[{id:'faq-explicit-choice',question:'대금을 모두 낸 경우에는 어떻게 되나요?',category:'현행법'}];
const classification={label:'복합 법률 질문',reason:'구체적인 지급 조건을 검토합니다.',model:'gpt-6-astra'};
const source=readFileSync(new URL('../src/ai-mingyu.tsx',import.meta.url),'utf8');
const fixture=source.replace('useState<Status|null>(null)','useState<Status|null>({connected:true})').replace("[question,setQuestion]=useState('')",'[question,setQuestion]=useState(__typed)').replace('useState<FaqSuggestion[]>([])','useState<FaqSuggestion[]>(__suggestions)').replace('useState<RouteInfo|null>(null)','useState<RouteInfo|null>(__classification)');
assert.notEqual(fixture,source);
const code=ts.transpileModule(fixture,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
function render(withSuggestions){
 const calls=[],module={exports:{}};
 const react={...React,useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useEffect(){},useRef:value=>({current:value}),useMemo:fn=>fn()};
 vm.runInNewContext(code,{module,exports:module.exports,__typed:typed,__suggestions:withSuggestions?suggestions:[],__classification:withSuggestions?classification:null,sessionStorage:{getItem:()=> 'bridge'},crypto:{randomUUID:()=> 'test-request'},AbortController,Date,require:id=>{
  if(id==='react')return react;
  if(id==='./ai-mingyu-client')return {MINGYU_SESSION_KEY:'test',mingyuRequest:async(path,token,body)=>{calls.push({path,token,body});return {answer:{summary:'검토 답변',sections:[],citations:[]},source:'model'};},sectionLabels:{}};
  if(id==='./thesis-faq-model')return {filterFaq:items=>items};
  if(id.startsWith('.'))return id.endsWith('.css')?{}:{__esModule:true,default:()=>null};
  return require(id);
 }});
 const tree=module.exports.default(),nodes=[];
 function visit(node){if(!node||typeof node!=='object')return;nodes.push(node);React.Children.forEach(node.props?.children,visit);}visit(tree);
 const form=nodes.find(node=>node.type==='form'&&node.props.className==='mingyu-question-form');assert.ok(form);
 return {form,calls,nodes};
}

test('late classification and FAQ results are above the draft; the send footer remains the final form row',()=>{
 for(const arrived of [false,true]){
  const {form}=render(arrived),rows=React.Children.toArray(form.props.children);
  assert.equal(rows.at(-1).props.className,'mingyu-compose-footer');
  const inputIndex=rows.findIndex(row=>row.type==='textarea');assert.equal(rows[inputIndex].props.value,typed);
  assert.ok(rows.findIndex(row=>row.type==='label')<inputIndex);
  if(arrived){assert.ok(rows.findIndex(row=>row.props.className==='mingyu-route')<inputIndex);assert.ok(rows.findIndex(row=>row.props.className==='mingyu-suggestions')<inputIndex);}
 }
});

test('sending after suggestions arrive submits the unchanged typed question, never a similar FAQ',async()=>{
 const h=render(true);await h.form.props.onSubmit({preventDefault(){}});
 const request=h.calls.find(call=>call.path==='/ask');assert.ok(request);assert.equal(request.body.question,typed);assert.ok(!('faqId' in request.body));
});

test('an explicitly clicked FAQ still submits its own exact ID and question',async()=>{
 const h=render(true),box=h.nodes.find(node=>node.props.className==='mingyu-suggestions');
 const button=React.Children.toArray(box.props.children).find(node=>node.type==='button');assert.ok(button);button.props.onClick();await Promise.resolve();
 const request=h.calls.find(call=>call.path==='/ask');assert.equal(request.body.faqId,suggestions[0].id);assert.equal(request.body.question,suggestions[0].question);
});
