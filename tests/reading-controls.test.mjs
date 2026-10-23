import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as readingView from '../src/reading-view.ts';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../src/reading-controls.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
function renderControl(view){
 const changed=[],panelChanges=[];
 const module={exports:{}};
 vm.runInNewContext(compiled,{module,exports:module.exports,require:id=>id==='react'?{...React,useState:initial=>[initial,()=>{}],useEffect:()=>{},useRef:()=>({current:null})}:id==='./reading-view'?readingView:require(id)});
 const tree=module.exports.default({view,onChange:v=>changed.push(v),sidebar:true,metadata:true,onSidebar:v=>panelChanges.push(v),onMetadata:v=>panelChanges.push(v),document:'source',onDocument:()=>{throw Error('Reading view must not switch documents');}});
 const all=[];function walk(node){if(!node||typeof node!=='object')return;if(node.type==='button')all.push(node);React.Children.forEach(node.props?.children,walk);}walk(tree);
 return {html:renderToStaticMarkup(tree),buttons:all,changed,panelChanges};
}
test('direct collapse is reachable without opening the view options',()=>{
 const normal={...readingView.DEFAULT_READING_VIEW,focus:false,tools:false,footnotes:false};
 const result=renderControl(normal);
 assert.ok(result.html.includes('메뉴 접기'));
 assert.ok(!result.html.includes('id="reading-view-options"'));
 const direct=result.buttons.find(b=>b.props.className?.split(' ').includes('reading-collapse-toggle'));
 assert.equal(direct.props['aria-expanded'],true);
 direct.props.onClick();
 assert.deepEqual(result.changed,[{...normal,focus:true}]);
 assert.deepEqual(result.panelChanges,[]);
 assert.equal(normal.focus,false);
});
test('one-click restore preserves every original menu preference and document selection',()=>{
 const normal={...readingView.DEFAULT_READING_VIEW,focus:false,header:false,tools:false};
 const result=renderControl(readingView.withReadingFocus(normal,true));
 assert.ok(result.html.includes('메뉴 펼치기'));
 const direct=result.buttons.find(b=>b.props.className?.split(' ').includes('reading-collapse-toggle'));
 assert.equal(direct.props['aria-expanded'],false);
 direct.props.onClick();
 assert.deepEqual(result.changed,[normal]);
 assert.deepEqual(result.panelChanges,[]);
});


test('reading focus retains common-edit connection errors and retry controls',()=>{
 const css=readFileSync(new URL('../src/reading-controls.css',import.meta.url),'utf8');
 const hiddenSelectors=[...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)].filter(m=>/display\s*:\s*none/.test(m[2])).map(m=>m[1]);
 assert.ok(hiddenSelectors.every(s=>!s.includes('.shared-edit-status')&&!s.includes('.app-error')));
});
