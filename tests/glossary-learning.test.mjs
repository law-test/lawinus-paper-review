import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as glossary from '../src/legal-glossary-model.ts';
import * as learning from '../src/legal-glossary-learning.ts';

const require=createRequire(import.meta.url);
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const data=glossary.parseGlossary(JSON.parse(read('../public/legal-glossary265.json')));
const easy=learning.parseLearningExamples(JSON.parse(read('../public/legal-glossary-learning270.json')));

test('every dictionary entry has one separately authored example in the same language',()=>{
 assert.equal(easy.size,data.entries.length);
 for(const entry of data.entries){const item=easy.get(entry.id);assert.ok(item,entry.term);assert.equal(item.language,entry.language,entry.term);assert.equal(item.kind,'authored-learning');assert.ok(item.text.length<220,entry.term);assert.ok(/[가-힣]/.test(item.translation),entry.term);}
});
test('learning data rejects duplicate IDs and unlabeled original-looking examples',()=>{
 const item={entryId:'e',language:'en',kind:'authored-learning',text:'The debtor pays.',translation:'채무자가 지급한다.'};
 assert.equal(learning.parseLearningExamples({items:[item]}).size,1);
 for(const items of [[item,item],[{...item,kind:'sentence'}],[{...item,language:'ko'}],[{...item,text:''}],[{...item,translation:''}]])assert.throws(()=>learning.parseLearningExamples({items}));
});

function getEntry(){
 const source=read('../src/legal-glossary.tsx')+'\nexport {Entry};';
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 vm.runInNewContext(compiled,{module,exports:module.exports,require:id=>id==='react'?{...React,useState:value=>[value,()=>{}]}:id==='./legal-glossary-model'?glossary:id==='./legal-glossary-learning'?learning:id.endsWith('.css')?{}:require(id)});
 return module.exports.Entry;
}
function walk(node,result=[]){if(!node||typeof node!=='object')return result;result.push(node);React.Children.forEach(node.props?.children,child=>walk(child,result));return result;}
test('learning sentence precedes the unaltered source, with independent speech and original evidence link',()=>{
 const entry=data.entries.find(e=>e.language==='en'&&e.term==='debtor');assert.ok(entry);
 const original=data.examples.find(e=>e.id===entry.exampleIds[0]);assert.ok(original);
 const calls=[];const nodes=walk(getEntry()({entry,learning:easy.get(entry.id),examples:[original],sourceNames:new Map(),favorite:false,onFavorite(){},speakingId:null,onSpeak:v=>calls.push(v)}));
 const learnIndex=nodes.findIndex(n=>n.props.className==='glossary-example glossary-learning-example');
 const sourceIndex=nodes.findIndex(n=>n.props.className==='glossary-example');
 assert.ok(learnIndex>0&&sourceIndex>learnIndex);
 assert.ok(nodes.some(n=>n.type==='p'&&n.props.children===original.text));
 assert.ok(nodes.some(n=>n.type==='p'&&n.props.children===original.translation));
 assert.ok(nodes.some(n=>n.type==='a'&&n.props.href===original.href));
 const buttons=nodes.filter(n=>n.type==='button'&&n.props['aria-label']?.includes('발음'));
 assert.equal(buttons.length,3);buttons.forEach(n=>n.props.onClick());
 assert.deepEqual(calls.map(c=>c.text),[entry.term,easy.get(entry.id).text,original.text]);
 assert.equal(new Set(calls.map(c=>c.id)).size,3);
 assert.ok(nodes.some(n=>n.props.children==='쉬운 예문 · 학습용'));
});
test('a mismatched or unavailable learning example cannot replace or hide the original',()=>{
 const entry=data.entries[0],original=data.examples.find(e=>e.id===entry.exampleIds[0]);assert.ok(original);
 for(const item of [undefined,{...easy.get(entry.id),language:'ja'}]){
  const nodes=walk(getEntry()({entry,learning:item,examples:[original],sourceNames:new Map(),favorite:false,onFavorite(){},speakingId:null,onSpeak(){}}));
  assert.ok(!nodes.some(n=>n.props.className==='glossary-example glossary-learning-example'));
  assert.ok(nodes.some(n=>n.type==='p'&&n.props.children===original.text));
 }
});
