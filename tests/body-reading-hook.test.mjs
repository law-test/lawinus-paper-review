import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import * as model from '../src/body-reading-position.ts';
const require=createRequire(import.meta.url);
const compiled=ts.transpileModule(readFileSync(new URL('../src/body-reading-hook.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function mount({saved,hidden=false,blocked=false,token=0,page=20}={}){
 const store=new Map(saved?[[model.bodyReadingKey('dataset:body'),JSON.stringify(saved)]]:[]),effects=[],refs=[],events=new Map(),ack=[],reports=[];let resize;
 const root={clientWidth:500,clientHeight:hidden?0:700,scrollTop:0,scrollLeft:0,scrollWidth:1000,getBoundingClientRect:()=>({top:0}),querySelectorAll:()=>[1,20,21,249].map(n=>({dataset:{manuscriptPage:String(n)},getBoundingClientRect:()=>{const start=n===1?0:n===20?4000:n===21?5000:100000;return {top:start-root.scrollTop,bottom:start+1000-root.scrollTop,height:1000};}}))};
 const module={exports:{}};vm.runInNewContext(compiled,{module,exports:module.exports,setTimeout:()=>1,clearTimeout:()=>{},ResizeObserver:class{constructor(cb){resize=cb;}observe(){}disconnect(){}},window:{addEventListener:(n,fn)=>events.set(n,fn),removeEventListener:()=>{}},document:{hidden:false,addEventListener:(n,fn)=>events.set(n,fn),removeEventListener:()=>{}},localStorage:{getItem:k=>{if(blocked)throw Error('blocked');return store.get(k)||null;},setItem:(k,v)=>{if(blocked)throw Error('blocked');store.set(k,v);}},require:id=>id==='react'?{useRef:x=>{const r={current:x};refs.push(r);return r;},useLayoutEffect:fn=>effects.push(fn)}:id==='./body-reading-position'?model:require(id)});
 const scroll=module.exports.useBodyReadingPosition({current:root},page,1.3,'dataset:body',p=>reports.push(p),token,t=>ack.push(t));effects.forEach(fn=>fn());
 return {root,scroll,store,events,ack,reports,resize:()=>resize()};
}
const saved={page:20,reportedPage:20,fraction:.25,leftRatio:.12,zoom:1.3};
test('body reload restores precise in-page and horizontal offsets then flushes latest scroll at pagehide',()=>{const h=mount({saved});assert.equal(h.root.scrollTop,4250);assert.equal(h.root.scrollLeft,120);h.root.scrollTop=4490;h.scroll();h.events.get('pagehide')();const p=JSON.parse(h.store.get(model.bodyReadingKey('dataset:body')));assert.equal(p.fraction,.49);assert.equal(p.reportedPage,20);});
test('an initially hidden body does not erase a pending bookmark',()=>{const h=mount({saved,hidden:true});assert.equal(h.root.scrollTop,0);h.root.clientHeight=700;h.resize();assert.equal(h.root.scrollTop,4250);assert.equal(h.root.scrollLeft,120);});
test('explicit same-page navigation starts at the page rather than its saved offset',()=>{const h=mount({saved,token:7});assert.equal(h.root.scrollTop,4000);assert.deepEqual(h.ack,[7]);});
test('storage unavailable still permits page navigation and pagehide',()=>{const h=mount({blocked:true,page:249});assert.equal(h.root.scrollTop,100000);h.scroll();assert.doesNotThrow(()=>h.events.get('pagehide')());});
