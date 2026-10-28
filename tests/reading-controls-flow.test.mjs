import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as readingView from '../src/reading-view.ts';
import * as swipe from '../src/mobile-menu-swipe.ts';
import * as tools from '../src/workspace-tools.ts';
import * as availability from '../src/ai-mingyu-availability.ts';
const require=createRequire(import.meta.url);
const read=name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
const code=ts.transpileModule(read('reading-controls.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
function style(){const values=new Map();return {values,setProperty:(key,value)=>values.set(key,value),removeProperty:key=>values.delete(key)};}
function harness({height=56,bottom=height,windowHeight=844,visualViewport,open=true}={}){
 const effects=[],cleanups=[],observed=[],states=[],focusCalls=[],windowEvents=new Map(),visualEvents=new Map();let box={height,bottom,top:bottom-height,right:600},observerCallback,disconnected=false;
 const app={style:style(),querySelector:()=>chrome},chrome={};
 const controls={style:style(),closest:()=>app,getBoundingClientRect:()=>box,contains:node=>node==='inside'};
 const viewport=visualViewport?{...visualViewport,addEventListener:(key,fn)=>visualEvents.set(key,fn),removeEventListener:key=>visualEvents.delete(key)}:undefined;
 const browser={innerHeight:windowHeight,innerWidth:1200,visualViewport:viewport,addEventListener:(key,fn)=>windowEvents.set(key,fn),removeEventListener:key=>windowEvents.delete(key)};
 Object.defineProperty(browser,'localStorage',{get(){throw Error('layout measurement must not access stored reading positions');}});
 const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,window:browser,ResizeObserver:class{constructor(callback){observerCallback=callback;}observe(node){observed.push(node);}disconnect(){disconnected=true;}},require:id=>{
  if(id==='react')return {...React,useState:()=>[open,value=>states.push(value)],useRef:initial=>({current:initial}),useEffect:effect=>effects.push(effect)};
  if(id==='./reading-view')return readingView;if(id==='./mobile-menu-swipe')return swipe;if(id==='./workspace-tools')return tools;if(id==='./ai-mingyu-availability')return availability;return require(id);
 }});
 const tree=module.exports.default({onTool(){},view:readingView.DEFAULT_READING_VIEW,onChange(){},sidebar:true,metadata:true,onSidebar(){},onMetadata(){},document:'thesis',onDocument(){},onEqualWidth(){}});
 tree.props.ref.current=controls;
 const nodes=[];function walk(node){if(!node||typeof node!=='object')return;nodes.push(node);React.Children.forEach(node.props?.children,walk);}walk(tree);
 nodes.find(node=>node.props.className==='reading-view-trigger').props.ref.current={focus:options=>focusCalls.push(options)};
 for(const effect of effects)cleanups.push(effect());
 return {app,controls,chrome,observed,states,focusCalls,browser,viewport,windowEvents,visualEvents,setBox:value=>{box={...box,...value};},resize:()=>observerCallback(),cleanup:()=>cleanups.forEach(fn=>fn?.()),get disconnected(){return disconnected;}};
}
test('wrapped or enlarged action rows publish their actual height and leave only the remaining viewport for the menu',()=>{
 const h=harness({height:56.4,bottom:56.4,windowHeight:900});
 assert.equal(h.app.style.values.get('--reading-actions-height'),'57px');assert.equal(h.controls.style.values.get('--reading-options-space'),'831px');
 h.setBox({height:104.2,bottom:104.2});h.resize();assert.equal(h.app.style.values.get('--reading-actions-height'),'105px');assert.equal(h.controls.style.values.get('--reading-options-space'),'783px');
 h.setBox({height:156.8,bottom:166.8});h.resize();assert.equal(h.app.style.values.get('--reading-actions-height'),'157px');assert.equal(h.controls.style.values.get('--reading-options-space'),'721px');
 assert.ok(h.observed.includes(h.controls));assert.ok(h.observed.includes(h.chrome));h.cleanup();
});
test('keyboard and visual viewport pan recalculate menu space from the visible bottom, not the full browser height',()=>{
 const h=harness({height:106,bottom:116,windowHeight:844,visualViewport:{height:300,offsetTop:55}});
 assert.equal(h.controls.style.values.get('--reading-options-space'),'227px');
 h.viewport.height=190;h.visualEvents.get('resize')();assert.equal(h.controls.style.values.get('--reading-options-space'),'117px');
 h.viewport.offsetTop=20;h.visualEvents.get('scroll')();assert.equal(h.controls.style.values.get('--reading-options-space'),'82px');h.cleanup();
});
test('an extremely small remaining area never gets a fictitious 64 pixel minimum',()=>{
 const h=harness({height:124,bottom:124,visualViewport:{height:142,offsetTop:0}});
 assert.equal(h.controls.style.values.get('--reading-options-space'),'6px');
 h.viewport.height=120;h.visualEvents.get('resize')();assert.equal(h.controls.style.values.get('--reading-options-space'),'0px');h.cleanup();
});
test('ordinary window resizing and cleanup keep observers and listeners bounded without changing reading storage',()=>{
 const h=harness({height:58,bottom:58,windowHeight:844});h.browser.innerHeight=390;h.windowEvents.get('resize')();assert.equal(h.controls.style.values.get('--reading-options-space'),'320px');
 h.cleanup();assert.equal(h.disconnected,true);assert.equal(h.windowEvents.size,0);assert.equal(h.visualEvents.size,0);assert.equal(h.app.style.values.has('--reading-actions-height'),false);
});
test('Escape restores the view trigger without scrolling a document, while an outside click simply closes the menu',()=>{
 const h=harness();let prevented=false;h.windowEvents.get('keydown')({key:'Escape',preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.deepEqual(h.states,[false]);assert.equal(h.focusCalls.length,1);assert.equal(h.focusCalls[0].preventScroll,true);
 h.windowEvents.get('pointerdown')({target:'inside'});assert.equal(h.states.length,1);
 h.windowEvents.get('pointerdown')({target:'outside'});assert.deepEqual(h.states,[false,false]);assert.equal(h.focusCalls.length,1);h.cleanup();
});
function rule(css,selector){return [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)].filter(match=>match[1].trim()===selector).map(match=>match[2]).join(';');}
test('view options share the basis row and restoration shares a document dock instead of covering metadata controls',()=>{
 const workspace=read('review-workspace.tsx'),css=read('reading-controls.css'),mobile=read('mobile-layout.css'),row=rule(css,'.reading-view-menu');
 assert.match(workspace,/<div className="basis-actions"><TextSizeControl\/>\{visibleSurfaces.header&&headerHeight!==0&&readingControls\}/);assert.doesNotMatch(workspace+css,/reading-restore-controls/);
 assert.match(workspace,/extraQuickControls=\{restorePane==='thesis'\?restoreControls:null\}/);
 assert.match(row,/position:\s*relative/);assert.match(row,/flex:\s*0 0 auto/);assert.match(row,/width:\s*100%/);assert.doesNotMatch(row,/position:\s*(fixed|absolute)|order\s*:/);
 assert.doesNotMatch(css+mobile,/reading-actions-clearance/);assert.doesNotMatch(css+mobile,/metadata-pane>\.reference-heading\{padding-top:calc\(var\(--reading-actions-height/);
 assert.match(rule(css,'.reading-view-actions'),/flex-wrap:\s*wrap/);assert.match(css,/max-width:380px[^}]*reading-tool-shortcut[^}]*white-space:normal/);
 assert.match(rule(css,'.reading-view-options'),/box-sizing:\s*border-box/);assert.match(rule(css,'.reading-view-options'),/overflow:\s*auto/);assert.match(rule(css,'.reading-view-options'),/reading-options-space/);
});
test('a menu opened from the bottom document dock grows upward inside the visible viewport',()=>{
 const h=harness({height:44,bottom:830,windowHeight:844});
 assert.equal(h.controls.style.values.get('--reading-options-top'),'auto');
 assert.equal(h.controls.style.values.get('--reading-options-bottom'),'64px');
 assert.equal(h.controls.style.values.get('--reading-options-space'),'774px');
 h.cleanup();
});
test('nonmodal tool windows stay below the view dropdown and existing editing dialogs',()=>{
 const nav=Number(rule(read('reading-controls.css'),'.reading-view-menu').match(/z-index:\s*(\d+)/)?.[1]);
 const popup=Number(rule(read('workspace-tool-popups.css'),'.workspace-tool-popups').match(/z-index:\s*(\d+)/)?.[1]);
 const modal=Number(rule(read('review.css'),'.modal-backdrop').match(/z-index:\s*(\d+)/)?.[1]);
 assert.ok(popup<nav,`popup ${popup} must not obscure dropdown ${nav}`);assert.ok(nav<modal,`dropdown ${nav} must not obscure dialog ${modal}`);
 const quick=rule(read('pdf-quick-controls.css'),'.pdf-quick-controls');assert.match(quick,/position:\s*absolute/);assert.ok(Number(quick.match(/z-index:\s*(\d+)/)?.[1])<nav);
});
test('wide but short desktops can use the actual viewport instead of a legacy 420 pixel application floor',()=>{
 const css=read('reading-controls.css'),selector='.four-pane-app.review-app';
 assert.match(rule(css,selector),/min-height:\s*0(?:;|$)/);
 assert.ok(css.indexOf(selector)<css.indexOf('@media'),'the desktop override must not be limited to a mobile media query');
 assert.match(rule(read('review.css'),'.review-app'),/height:\s*100dvh/);
});
