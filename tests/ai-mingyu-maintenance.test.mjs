import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as availability from '../src/ai-mingyu-availability.ts';
import * as workspaceTools from '../src/workspace-tools.ts';
import * as reading from '../src/reading-view.ts';
const require=createRequire(import.meta.url);
function load(name,imports={},globals={}){
 const module={exports:{}},source=readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,URL,Map,Set,Promise,...globals,require:id=>{
  if(id in imports)return imports[id];
  if(id==='./ai-mingyu-availability'||id==='./ai-mingyu-availability.ts')return availability;
  if(id==='react')return {...React,useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useEffect(){},useRef:value=>({current:value}),lazy:()=>function LazyPrivate(){throw Error('private component mounted');}};
  if(id==='./workspace-tools')return workspaceTools;if(id==='./reading-view')return reading;
  if(id.startsWith('.'))return {__esModule:true,default:()=>null};return require(id);
 }});return module.exports;
}
function walk(root){const nodes=[];function visit(node){if(!node||typeof node!=='object')return;nodes.push(node);React.Children.forEach(node.props?.children,visit);}visit(root);return nodes;}
function text(root){if(typeof root==='string')return root;if(!root||typeof root!=='object')return '';return React.Children.toArray(root.props?.children).map(text).join('');}
test('the deployed setting has the exact requested name and exposes only a maintenance notice',()=>{
 assert.equal(availability.AI_MINGYU_ENABLED,false);assert.equal(availability.AI_MINGYU_LABEL,'AI민규(만드는 중)');
 for(const owner of [false,true]){
  const Component=load('ai-mingyu.tsx',{'react':{...React,useState:()=>[owner,()=>{}],lazy:()=>function Private(){throw Error('private mounted');}},'./ai-mingyu-public':{default:function Public(){throw Error('public mounted');}}},{sessionStorage:new Proxy({},{get(){throw Error('private storage touched');}})}).default;
  const tree=Component(),nodes=walk(tree);assert.equal(tree.type,'section');assert.match(text(tree),/AI민규\(만드는 중\)/);assert.equal(nodes.some(n=>n.type==='form'||n.type==='textarea'||typeof n.type==='function'),false);
  assert.equal(nodes.find(n=>n.type==='a').props.href,'./?view=faq');
 }
});
test('start cards disable AI even if its click callback is invoked, and retain the glossary',()=>{
 const opened=[],tree=load('workspace-launchers.tsx').default({onOpen:tool=>opened.push(tool)}),nodes=walk(tree);
 const ai=nodes.find(n=>n.props?.['data-workspace-tool-launch']==='ai-mingyu');assert.equal(ai.props.disabled,true);assert.match(text(ai),/AI민규\(만드는 중\)/);ai.props.onClick();assert.deepEqual(opened,[]);
 nodes.find(n=>n.props?.['data-workspace-tool-launch']==='glossary').props.onClick();assert.deepEqual(opened,['glossary']);
});
test('reading controls expose no clickable AI URL and keep the glossary shortcut',()=>{
 const opened=[],noop=()=>{},tree=load('reading-controls.tsx').default({onTool:tool=>opened.push(tool),view:reading.DEFAULT_READING_VIEW,onChange:noop,sidebar:true,metadata:true,onSidebar:noop,onMetadata:noop,document:'thesis',onDocument:noop,onEqualWidth:noop}),nodes=walk(tree);
 const ai=nodes.find(n=>n.props?.className==='reading-tool-shortcut reading-mingyu-shortcut');assert.equal(ai.type,'button');assert.equal(ai.props.disabled,true);assert.equal(ai.props.href,undefined);assert.equal(text(ai),'AI민규(만드는 중)');
 nodes.find(n=>n.props?.className==='reading-tool-shortcut reading-glossary-shortcut').props.onClick({button:0,preventDefault(){}});assert.deepEqual(opened,['glossary']);
});
test('private requests and bridge connection attempts cannot touch a browser or network',async()=>{
 let touched=0;const forbidden=()=>{touched++;throw Error('must not run');};
 const bridge=load('ai-mingyu-bridge.ts',{}, {window:new Proxy({},{get:forbidden}),crypto:new Proxy({},{get:forbidden}),fetch:forbidden});
 assert.equal(bridge.mingyuBridgeActive(),false);assert.throws(()=>bridge.openMingyuConnection(forbidden,forbidden),/준비 중/);
 await assert.rejects(()=>bridge.bridgeRequest('/ask',{question:'새 질문'}),/준비 중/);
 const client=load('ai-mingyu-client.ts',{'./ai-mingyu-bridge.ts':bridge},{fetch:forbidden});
 for(const path of ['/status','/pair','/search','/ask','/history'])await assert.rejects(()=>client.mingyuRequest(path,'unused',{question:'새 질문'}),/준비 중/);
 assert.equal(touched,0);
});
