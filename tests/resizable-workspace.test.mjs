import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as paneSize from '../src/pane-size.ts';
import {DEFAULT_WORKSPACE_LAYOUT,readWorkspaceLayout,saveWorkspaceLayout,validateWorkspaceLayout,boundedPanelHeight,stackedDocumentRows,stackedDocumentColumns} from '../src/workspace-layout.ts';

test('layout defaults retain columns; all independent dimensions survive reload and reject invalid state',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 assert.deepEqual(readWorkspaceLayout(storage),DEFAULT_WORKSPACE_LAYOUT);
 const custom={...DEFAULT_WORKSPACE_LAYOUT,orientation:'rows',rowSplit:61,stackedSourceEnd:70,headerHeight:102,footerHeight:93,metadataSplit:40,sidebarMenuHeight:180};
 assert.equal(saveWorkspaceLayout(storage,custom),true);assert.deepEqual(readWorkspaceLayout(storage),custom);
 assert.deepEqual(validateWorkspaceLayout({schema:2}),DEFAULT_WORKSPACE_LAYOUT);
 const invalid=validateWorkspaceLayout({schema:1,rowSplit:999,metadataSplit:-10,headerHeight:NaN,footerHeight:Infinity,sidebarMenuHeight:9999});
 assert.equal(invalid.rowSplit,75);assert.equal(invalid.metadataSplit,20);assert.equal(invalid.headerHeight,null);assert.equal(invalid.footerHeight,null);assert.equal(invalid.sidebarMenuHeight,650);
 assert.deepEqual(readWorkspaceLayout({getItem(){throw Error();}}),DEFAULT_WORKSPACE_LAYOUT);
 assert.equal(saveWorkspaceLayout({setItem(){throw Error();}},custom),false);
});
test('small viewports clamp panels without erasing their saved desktop dimensions',()=>{
 const layout={...DEFAULT_WORKSPACE_LAYOUT,headerHeight:350,footerHeight:250};
 assert.equal(boundedPanelHeight(layout.headerHeight,300,44,.4,132),120);
 assert.equal(boundedPanelHeight(layout.footerHeight,300,44,.35,48),105);
 assert.equal(layout.headerHeight,350);assert.equal(layout.footerHeight,250);
 assert.equal(stackedDocumentRows(50),'minmax(0,50fr) 8px minmax(0,50fr)');
 assert.equal(stackedDocumentColumns(72,false),'minmax(0,1fr)');
 assert.match(stackedDocumentColumns(72,true),/72fr.*28fr/);
});
const require=createRequire(import.meta.url),compiled=ts.transpileModule(readFileSync(new URL('../src/pane-resizer.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
function divider(axis,getValue){const module={exports:{}},changes=[],body={style:{cursor:'auto',userSelect:'text'}};vm.runInNewContext(compiled,{module,exports:module.exports,document:{body},require:id=>id==='react'?{...React,useRef:initial=>({current:initial}),useState:initial=>[initial,()=>{}],useCallback:fn=>fn,useEffect:()=>{}}:id==='./pane-size'?paneSize:require(id)});return {body,changes,tree:module.exports.default({axis,getValue,label:'경계',value:50,min:20,max:80,onChange:v=>changes.push(v),unitsPerPixel:()=>.5})};}
function pointer(extra={}){return {button:0,isPrimary:true,pointerId:1,clientX:100,clientY:100,preventDefault(){},currentTarget:{focus(){},setPointerCapture(){},hasPointerCapture(){return true;},releasePointerCapture(){}},...extra};}
test('vertical separators use pointer Y and keyboard Up/Down without hijacking other axes',()=>{
 const r=divider('y');assert.equal(r.tree.props['aria-orientation'],'horizontal');
 r.tree.props.onPointerDown(pointer());r.tree.props.onPointerMove(pointer({clientX:900,clientY:140}));assert.deepEqual(r.changes,[70]);assert.equal(r.body.style.cursor,'row-resize');
 r.tree.props.onPointerUp(pointer());assert.equal(r.body.style.cursor,'auto');assert.equal(r.body.style.userSelect,'text');
 r.tree.props.onKeyDown({key:'ArrowUp',preventDefault(){}});r.tree.props.onKeyDown({key:'ArrowDown',preventDefault(){}});r.tree.props.onKeyDown({key:'ArrowRight',preventDefault(){throw Error('wrong axis');}});assert.deepEqual(r.changes,[70,48,52]);
});
test('horizontal separators keep their previous X behavior and cancel releases capture',()=>{
 const r=divider();assert.equal(r.tree.props['aria-orientation'],'vertical');
 r.tree.props.onPointerDown(pointer());r.tree.props.onPointerMove(pointer({clientX:80,clientY:800}));assert.deepEqual(r.changes,[40]);
 r.tree.props.onPointerCancel(pointer());r.tree.props.onPointerMove(pointer({clientX:150}));assert.deepEqual(r.changes,[40]);assert.equal(r.body.style.cursor,'auto');
});


test('natural-height dividers read the live height when dragging begins after font reflow',()=>{
 let measured=64;const r=divider('y',()=>measured);measured=72;
 r.tree.props.onPointerDown(pointer());r.tree.props.onPointerMove(pointer());assert.deepEqual(r.changes,[72],'first move starts at the rendered height, not stale props');
 r.tree.props.onPointerMove(pointer({clientY:108}));assert.deepEqual(r.changes,[72,76]);r.tree.props.onPointerUp(pointer());
 measured=70;r.tree.props.onKeyDown({key:'ArrowUp',preventDefault(){}});assert.equal(r.changes.at(-1),68);
});
