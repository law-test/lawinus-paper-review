import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as tools from '../src/workspace-tools.ts';
import * as availability from '../src/ai-mingyu-availability.ts';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../src/workspace-launchers.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
test('start cards show paused AI and the working glossary, and can be folded away',()=>{
 let dismissed=false;const calls=[],module={exports:{}};
 vm.runInNewContext(compiled,{module,exports:module.exports,require:id=>id==='react'?{...React,useState:()=>[dismissed,next=>{dismissed=next;}]}:id==='./workspace-tools'?{...tools,launchWorkspaceTool:(event,tool)=>tools.launchWorkspaceTool(event,tool,id=>{calls.push(id);return true;})}:id==='./ai-mingyu-availability'?availability:id.endsWith('.css')?{}:require(id)});
 const tree=module.exports.default({compactHeader:true,onOpen:tool=>calls.push(tool)});const html=renderToStaticMarkup(tree);
 assert.match(html,/AI민규\(만드는 중\)/);assert.match(html,/법학어학사전/);assert.match(html,/새 창 열기/);assert.doesNotMatch(html,/팝업 열기/);assert.match(html,/compact-header/);assert.deepEqual(calls,[]);
 const nodes=[];function walk(node){if(!node||typeof node!=='object')return;nodes.push(node);React.Children.forEach(node.props?.children,walk);}walk(tree);
 const cards=nodes.filter(n=>n.type==='button'&&n.props['data-workspace-tool-launch']);assert.equal(cards.length,2);for(const card of cards){assert.equal(card.props.type,'button');card.props.onClick();}
 assert.equal(cards[0].props.disabled,true);assert.ok(!cards[1].props.disabled);assert.deepEqual(calls,['glossary']);
 nodes.find(n=>n.type==='button').props.onClick();assert.equal(module.exports.default({}),null);
});

test('application entry renders a standalone dictionary, standalone chat, or the unchanged workspace as requested',()=>{
 const main=ts.transpileModule(readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 function Workspace(){return null;}function Glossary(){return null;}function Chat(){return null;}
 for(const [search,expected,className,embedded=false] of [['?view=glossary&dictionary=1',Glossary,'glossary-standalone'],['?view=ai-mingyu&chat=1',Chat,'mingyu-standalone'],['?view=glossary',Workspace,undefined],['?v=265c',Workspace,undefined],['?view=glossary&dictionary=1&embedded=1',Glossary,'glossary-standalone',true],['?view=ai-mingyu&chat=1&embedded=1',Chat,'mingyu-standalone',true]]){
  let captured;const module={exports:{}};
  vm.runInNewContext(main,{module,exports:module.exports,URLSearchParams,window:{location:{search},self:embedded?{}:null,top:null},document:{getElementById:()=>({})},require:id=>{
   if(id==='react')return {...React,useState:()=>['ready',()=>{}],useEffect:()=>{}};
   if(id==='react-dom/client')return {createRoot:()=>({render:element=>{captured=element;}})};
   if(id==='./review-workspace')return {__esModule:true,default:Workspace};
   if(id==='./legal-glossary')return {__esModule:true,default:Glossary};
   if(id==='./ai-mingyu')return {__esModule:true,default:Chat};
   if(id==='./workspace-tools')return tools;
   if(id==='./ai-mingyu-availability')return availability;
   if(id==='./legal-links')return {LegalLinkProvider:({children})=>children};
   if(id==='./text-size')return {applyTextSize(){},readTextSize(){return 1;}};
   if(id==='./review-api'||id.endsWith('.css'))return {};
   return require(id);
  }});
  const tree=captured.type();const nodes=[];function walk(node){if(!node||typeof node!=='object')return;nodes.push(node);React.Children.forEach(node.props?.children,walk);}walk(tree);
  assert.ok(nodes.some(n=>n.type===expected),search);assert.equal(nodes.filter(n=>[Workspace,Glossary,Chat].includes(n.type)).length,1);
  if(className){assert.ok(nodes.some(n=>n.type==='main'&&n.props.className===className));assert.equal(nodes.filter(n=>n.type==='nav').length,embedded?0:1);}
 }
});
