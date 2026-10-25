import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as publicModel from '../src/ai-mingyu-public-model.ts';
import * as levels from '../src/ai-mingyu-level.ts';
import * as enter from '../src/ai-mingyu-enter.ts';
const require=createRequire(import.meta.url),data=JSON.parse(readFileSync(new URL('../src/ai-mingyu-public-answers.json',import.meta.url),'utf8'));
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const publicCode=compile(readFileSync(new URL('../src/ai-mingyu-public.tsx',import.meta.url),'utf8').replaceAll("import('./ai-mingyu-public-client')",'Promise.resolve(__publicClient)'));
function walk(tree){const nodes=[];function visit(node){if(!node||typeof node!=='object')return;nodes.push(node);React.Children.forEach(node.props?.children,visit);}visit(tree);return nodes;}
function harness(){
 const module={exports:{}},states=[],refs=[],calls=[],effects=[];let cursor=0,refCursor=0,tree,serial=0;
 const react={...React,useState:initial=>{const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];},useRef:initial=>refs[refCursor++]??={current:initial},useMemo:fn=>fn(),useEffect:fn=>effects.push(fn)};
 vm.runInNewContext(publicCode,{module,exports:module.exports,__publicClient:{publicServiceStatus:async()=>false,askPublicMingyu:async()=>{calls.push('network ask');throw Error('not expected');}},crypto:{randomUUID:()=>String(++serial)},AbortController,Promise,require:id=>{
  if(id==='react')return react;if(id==='./ai-mingyu-public-answers.json')return {default:data};if(id==='./ai-mingyu-public-model')return publicModel;
  if(id==='./ai-mingyu-level')return {...levels,readAnswerLevel:()=> 'undergraduate',saveAnswerLevel:level=>calls.push({savedLevel:level})};
  if(id==='./ai-mingyu-enter')return enter;
  if(id.startsWith('.'))return {__esModule:true,default:()=>null};return require(id);
 }});
 function render(){cursor=0;refCursor=0;effects.length=0;tree=module.exports.default({onOwner:()=>calls.push('owner clicked'),renderAnswer:props=>React.createElement('answer-card',props)});return tree;}
 function nodes(){return walk(tree);}
 async function ask(question){nodes().find(n=>n.type==='textarea').props.onChange({target:{value:question}});render();nodes().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await Promise.resolve();render();}
 render();return {render,nodes,ask,calls,effects};
}
test('public wrapper mounts no private component and does not read a private token until the author explicitly chooses it',()=>{
 const code=compile(readFileSync(new URL('../src/ai-mingyu.tsx',import.meta.url),'utf8'));const module={exports:{}};let owner=false,lazyCalls=0;function Public(){return null;}function LazyPrivate(){return null;}
 vm.runInNewContext(code,{module,exports:module.exports,sessionStorage:new Proxy({},{get(){throw Error('private token touched');}}),require:id=>{
  if(id==='react')return {...React,useState:()=>[owner,value=>{owner=value;}],lazy:factory=>{lazyCalls++;return LazyPrivate;}};
  if(id==='./ai-mingyu-public')return {__esModule:true,default:Public};if(id==='./ai-mingyu-answer')return {AnswerCards:()=>null};if(id.endsWith('.css'))return {};
  if(id==='./ai-mingyu-availability')return {AI_MINGYU_ENABLED:true};
  if(id.startsWith('.'))throw Error('private module imported on entry: '+id);return require(id);
 }});
 let tree=module.exports.default();assert.equal(tree.type,Public);assert.equal(lazyCalls,1);assert.ok(!walk(tree).some(n=>n.type===LazyPrivate));
 tree.props.onOwner();tree=module.exports.default();assert.ok(walk(tree).some(n=>n.type===LazyPrivate));
});
test('an exact public FAQ returns the unchanged vetted answer without generation',async()=>{
 const h=harness();assert.equal(h.nodes().filter(n=>n.type==='answer-card').length,0);await h.ask(data.items[0].question);
 const card=h.nodes().find(n=>n.type==='answer-card');assert.equal(card.props.answer,data.items[0].answer);assert.equal(card.props.source,'faq');assert.equal(card.props.level,'undergraduate');assert.deepEqual(h.calls,[]);
 const form=h.nodes().find(n=>n.type==='form');assert.equal(React.Children.toArray(form.props.children).at(-1).props.className,'mingyu-compose-footer');
});
test('a similar question only offers selectable FAQs and never automatically substitutes their answers',async()=>{
 const h=harness();await h.ask(data.items[0].question+' 비용도 비교해 주세요');
 assert.equal(h.nodes().filter(n=>n.type==='answer-card').length,0);
 const choices=h.nodes().filter(n=>n.type==='button'&&data.items.some(item=>item.question===n.props.children));assert.ok(choices.length>0);
 choices[0].props.onClick();await Promise.resolve();h.render();assert.equal(h.nodes().filter(n=>n.type==='answer-card').length,1);assert.deepEqual(h.calls,[]);
});
test('level selection applies to subsequent answers while an earlier FAQ keeps its original level and text',async()=>{
 const h=harness();await h.ask(data.items[0].question);h.nodes().find(n=>typeof n.type==='function'&&n.type.name==='AnswerLevelControl').props.onChange('high-school');h.render();await h.ask(data.items[1].question);
 const cards=h.nodes().filter(n=>n.type==='answer-card');assert.deepEqual(cards.map(n=>n.props.level),['undergraduate','high-school']);assert.equal(cards[1].props.answer,data.items[1].answer);
});
test('doctoral view opens sources and high-school view adds separate explanations without rewriting FAQ paragraphs',()=>{
 const code=compile(readFileSync(new URL('../src/ai-mingyu-answer.tsx',import.meta.url),'utf8'));const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,URL,Date,require:id=>id==='react'?{...React,default:React,useState:initial=>[initial,()=>{}]}:id==='./ai-mingyu-public-model'?publicModel:require(id)});
 const item=data.items.find(item=>item.answer.sections.some(s=>s.text.includes('채권')));const expected=item.answer.sections.map(s=>s.text);
 for(const level of ['doctoral','undergraduate','high-school']){
  const tree=module.exports.AnswerCards({turn:{question:item.question,answer:item.answer,source:'faq',level}}),nodes=walk(tree);
  assert.deepEqual(nodes.filter(n=>n.type==='section').map(n=>React.Children.toArray(n.props.children).find(c=>c.type==='p').props.children),expected);
  assert.ok(nodes.filter(n=>n.type==='details').every(n=>n.props.open===(level==='doctoral')));
  assert.equal(nodes.some(n=>n.props.className==='mingyu-plain-terms'),level==='high-school');
 }
});
test('all public exact answers retain their legal categories and supplied citations',()=>{
 const index=publicModel.publicAnswerIndex(data.items);assert.equal(data.items.length,300);
 for(const item of data.items){assert.equal(index.exact(item.question,item.id),item);assert.ok(item.answer.sections.every(s=>s.citationIds.every(id=>item.answer.citations.some(c=>c.id===id))));}
});
