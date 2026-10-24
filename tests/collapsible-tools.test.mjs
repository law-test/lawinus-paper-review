import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as sizes from '../src/pane-size.ts';
import * as layout from '../src/workspace-layout.ts';
const require=createRequire(import.meta.url);
function load(name,react=React,deps={},globals={}){
 const output=ts.transpileModule(readFileSync(new URL('../src/'+name,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,module={exports:{}};
 vm.runInNewContext(output,{module,exports:module.exports,...globals,require:id=>id==='react'?react:id in deps?deps[id]:require(id)});return module.exports;
}
const Resizer=load('pane-resizer.tsx',React,{'./pane-size':sizes}).default;
const Panel=load('reader-tool-panel.tsx',React,{'./pane-resizer':{__esModule:true,default:Resizer},'./workspace-layout':layout}).default;
const Controls=load('reader-controls.tsx').default;

test('zero heights persist independently and older saved layouts retain natural new tool heights',()=>{
 const values=new Map(),storage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)};
 const collapsed={...layout.DEFAULT_WORKSPACE_LAYOUT,headerHeight:0,sidebarMenuHeight:0,thesisToolsHeight:0,sourceToolsHeight:0,footerHeight:0};
 assert.equal(layout.saveWorkspaceLayout(storage,collapsed),true);assert.deepEqual(layout.readWorkspaceLayout(storage),collapsed);
 const old=layout.validateWorkspaceLayout({schema:1,headerHeight:44,sidebarMenuHeight:88});
 assert.equal(old.headerHeight,44);assert.equal(old.sidebarMenuHeight,88);assert.equal(old.thesisToolsHeight,null);assert.equal(old.sourceToolsHeight,null);
 const invalid=layout.validateWorkspaceLayout({schema:1,thesisToolsHeight:-8,sourceToolsHeight:NaN});
 assert.equal(invalid.thesisToolsHeight,0);assert.equal(invalid.sourceToolsHeight,null);
 assert.equal(layout.boundedPanelHeight(0,300,0,.7,160),0);
 assert.equal(layout.boundedPanelHeight(500,300,0,.7,160),180);
});

test('a zero tool viewport keeps controls mounted but inert and leaves a separate keyboard-accessible handle',()=>{
 const html=renderToStaticMarkup(React.createElement(Panel,{className:'thesis-controls',label:'논문 위 도구 영역 높이 조절',height:0,available:800,onChange(){},onReset(){}},React.createElement('button',null,'보존한 도구')));
 assert.match(html,/data-collapsed="true" inert="" aria-hidden="true" style="height:0;flex-basis:0/);
 assert.match(html,/>보존한 도구<\/button><\/div><div class="pane-resizer horizontal-resizer reader-tools-divider/);
 assert.match(html,/aria-valuenow="0"[^>]+aria-valuemin="0"[^>]+tabindex="0"/);
 assert.match(html,/Home 접기 · End 펼치기 · 두 번 누르면 초기화/);
 const restored=renderToStaticMarkup(React.createElement(Panel,{className:'source-controls',label:'원전 위 도구 영역 높이 조절',height:175,available:800,onChange(){},onReset(){}},'도구'));
 assert.match(restored,/height:175px;flex-basis:175px/);assert.ok(!restored.includes('inert='));
});

test('vertical dragging can close fully and a new drag restores smoothly; Home/End and reset remain usable',()=>{
 let height=140,resets=0;const body={style:{cursor:'default',userSelect:'text'}};
 const hooks={...React,useRef:value=>({current:value}),useState:value=>[value,()=>{}],useEffect(){},useCallback:fn=>fn};
 const Divider=load('pane-resizer.tsx',hooks,{'./pane-size':sizes},{document:{body}}).default;
 const node=Divider({axis:'y',label:'도구',value:140,getValue:()=>height,min:0,max:300,unit:'픽셀',step:16,onChange:v=>height=v,onReset:()=>{height=140;resets++;}});
 const element={focus(){},setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){}};
 const pointer=y=>({button:0,isPrimary:true,pointerId:1,clientX:0,clientY:y,currentTarget:element,preventDefault(){}});
 node.props.onPointerDown(pointer(240));node.props.onPointerMove(pointer(10));assert.equal(height,0);node.props.onPointerUp(pointer(10));assert.equal(body.style.cursor,'default');
 node.props.onPointerDown(pointer(10));node.props.onPointerMove(pointer(95));assert.equal(height,85);node.props.onPointerUp(pointer(95));
 node.props.onKeyDown({key:'Home',preventDefault(){}});assert.equal(height,0);
 node.props.onKeyDown({key:'ArrowDown',preventDefault(){}});assert.equal(height,16);
 node.props.onKeyDown({key:'End',preventDefault(){}});assert.equal(height,300);
 node.props.onDoubleClick();assert.equal(height,140);assert.equal(resets,1);
});

test('the same reader controls render inline elsewhere, wait for the shared host, then use a React portal',()=>{
 const children=React.createElement('button',null,'글자 선택');
 assert.match(renderToStaticMarkup(React.createElement(Controls,{children})),/글자 선택/);
 assert.equal(Controls({host:null,children}),null);
 const host={nodeType:1},portal=Controls({host,children});
 assert.equal(portal.$$typeof,Symbol.for('react.portal'));assert.equal(portal.containerInfo,host);assert.equal(portal.children,children);
});

test('collapse preserves existing feature entries and body split settings while manual tool sizing overrides alignment',()=>{
 const source=readFileSync(new URL('../src/review-workspace.tsx',import.meta.url),'utf8');
 for(const token of ['LegalGlossary','openMingyuChatWindow','ThesisFaq','reviewDeepLink','proposalAnnotation'])assert.ok(source.includes(token));
 assert.match(source,/workspaceLayout\.thesisToolsHeight===null&&workspaceLayout\.sourceToolsHeight===null&&workspaceLayout\.footerHeight===null/);
 assert.equal(layout.stackedDocumentRows(63),'minmax(0,63fr) 8px minmax(0,37fr)');
 const css=readFileSync(new URL('../src/workspace-layout.css',import.meta.url),'utf8');
 assert.match(css,/\.review-app \.pane-resizer\.horizontal-resizer\{height:8px;min-height:8px;max-height:8px;flex-basis:8px\}/);
 assert.match(css,/\.view-hide-tools \.reader-tool-panel/);
});
