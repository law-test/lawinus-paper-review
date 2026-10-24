import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as model from '../src/pdf-viewer-model.ts';

const require=createRequire(import.meta.url);
const code=ts.transpileModule(readFileSync(new URL('../src/pdf-viewer.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
function QuickTools(){return null;}
function memory(initial=[]){const map=new Map(initial);return {map,getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};}
function harness({storage=memory(),width=390,height=700,page=20,zoom=1,fitMode=null,id='thesis',navigationToken=0,scrollQuantum=0}={}){
 const hooks=[],layouts=[],effects=[],observers=new Set(),frames=new Map(),timers=new Map(),reports=[],acks=[];
 let index=0,dirty=true,tree,top=0,left=0,contentHeight=1,contentWidth=1,serial=0,resolveDoc;
 const win=Object.assign(new EventTarget(),{localStorage:storage}),document=Object.assign(new EventTarget(),{hidden:false,baseURI:'https://example.invalid/'});
 const rounded=value=>scrollQuantum?Math.round(value/scrollQuantum)*scrollQuantum:value;
 const host={clientWidth:width,clientHeight:height,hasPointerCapture:()=>false,releasePointerCapture(){},get scrollTop(){return top;},set scrollTop(v){top=Math.max(0,Math.min(rounded(v),Math.max(0,contentHeight+36-host.clientHeight)));},get scrollLeft(){return left;},set scrollLeft(v){left=Math.max(0,Math.min(rounded(v),Math.max(0,contentWidth+44-host.clientWidth)));}};
 let docPromise=new Promise(resolve=>{resolveDoc=resolve;});
 const props={id,page,total:279,zoom,fitMode,quickTools:true,persistenceKey:'d:'+id,navigationToken,onZoomResolved:value=>{props.zoom=value;dirty=true;},onZoomChange:value=>{props.zoom=value;props.fitMode=null;dirty=true;},onFitModeChange:value=>{props.fitMode=value;dirty=true;},onPageChange:value=>{reports.push(value);props.page=value;dirty=true;},onNavigationHandled:value=>{acks.push(value);if(props.navigationToken===value){props.navigationToken=0;dirty=true;}}};
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const useMemo=(fn,deps)=>{const i=index++;if(!hooks[i]||!same(hooks[i].deps,deps))hooks[i]={value:fn(),deps};return hooks[i].value;};
 const useEffect=(queue)=>(fn,deps)=>{const i=index++,old=hooks[i];if(!old||!same(old.deps,deps)){hooks[i]={deps,cleanup:old?.cleanup};queue.push(()=>{hooks[i].cleanup?.();hooks[i].cleanup=fn();});}};
 const react={...React,useRef:initial=>{const i=index++;return hooks[i]??= {current:initial};},useState:initial=>{const i=index++;if(!(i in hooks))hooks[i]={value:typeof initial==='function'?initial():initial};return [hooks[i].value,next=>{const value=typeof next==='function'?next(hooks[i].value):next;if(!Object.is(value,hooks[i].value)){hooks[i].value=value;dirty=true;}}];},useMemo,useCallback:(fn,deps)=>useMemo(()=>fn,deps),useLayoutEffect:useEffect(layouts),useEffect:useEffect(effects)};
 const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,window:win,document,URL,performance,getComputedStyle:()=>({paddingLeft:'22',paddingRight:'22'}),requestAnimationFrame:fn=>{const n=++serial;frames.set(n,fn);return n;},cancelAnimationFrame:n=>frames.delete(n),setTimeout:fn=>{const n=++serial;timers.set(n,fn);return n;},clearTimeout:n=>timers.delete(n),ResizeObserver:class{constructor(fn){this.fn=fn;}observe(){observers.add(this.fn);this.fn();}disconnect(){observers.delete(this.fn);}},require:name=>{
  if(name==='react')return react;
  if(name==='./pdf-viewer-model')return {...model,createPdfRuntimeCache:()=>({get:async()=>({getDocument:()=>({promise:docPromise,destroy:async()=>{}})}),retry(){}})};
  if(name==='./review-api')return {assetUrl:key=>'https://example.invalid/'+key};
  if(name==='./pdf-quick-controls')return {__esModule:true,default:QuickTools};
  if(name==='./proposal-indicators')return {pageProposalMarkers:()=>[]};
  if(name.endsWith('.css'))return {};return require(name);
 }});
 function nodes(){const result=[];function walk(node){if(!node||typeof node!=='object')return;result.push(node);React.Children.forEach(node.props?.children,walk);}walk(tree);return result;}
 function render(){dirty=false;index=0;tree=module.exports.default(props);const ns=nodes();const root=ns.find(n=>n.props?.className?.includes('continuous-pdf')&&n.props?.onScroll);root.props.ref.current=host;const pages=ns.find(n=>n.props?.className==='pdf-continuous-pages');contentHeight=pages.props.style.height;contentWidth=pages.props.style.width;host.scrollTop=top;host.scrollLeft=left;while(layouts.length)layouts.shift()();while(effects.length)effects.shift()();}
 function settle(withFrames=true){let loops=0;while(dirty||(withFrames&&frames.size)){assert.ok(++loops<60,'render/frame loop must settle');if(dirty)render();else{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn());}}}
 async function load(){resolveDoc({numPages:279});for(let i=0;i<3;i++){await new Promise(resolve=>setImmediate(resolve));settle();}}
 function resize(w,h,{frames=true,observe=true}={}){host.clientWidth=w;host.clientHeight=h;host.scrollTop=top;host.scrollLeft=left;if(observe)for(const fn of observers)fn();settle(frames);}
 function scroll(nextTop,nextLeft=left,{frames=true}={}){host.scrollTop=nextTop;host.scrollLeft=nextLeft;nodes().find(n=>n.props?.onScroll).props.onScroll({currentTarget:host});settle(frames);}
 function flush({frames=true}={}){win.dispatchEvent(new Event('pagehide'));settle(frames);}
 function change(next,{frames=true}={}){Object.assign(props,next);dirty=true;settle(frames);}
 function quick(next){nodes().find(n=>n.type===QuickTools).props.onPageChange(next);settle();}
 function fit(next,{frames=true}={}){nodes().find(n=>n.type===QuickTools).props.onFitModeChange(next);settle(frames);}
 function numeric(next){nodes().find(n=>n.type===QuickTools).props.onZoomChange(next);settle();}
 function dimensions(){return nodes().find(n=>n.props?.className==='pdf-continuous-pages').props.style;}
 function dispose(){for(const h of hooks)h?.cleanup?.();frames.clear();timers.clear();}
 settle();return {host,props,storage,reports,acks,load,resize,scroll,flush,change,quick,fit,numeric,dimensions,dispose,settle};
}
function bookmark(storage,{width=346,zoom=1.6,page=249,fraction=.37,left=121.25,key='d:thesis'}={}){const layout=model.pageLayout(279,width,zoom,{}),position=model.capturePdfReadingPosition(key,layout,layout.offsets[page-1]+layout.heights[page-1]*fraction+18,left,page,zoom,{});model.writePdfReadingPosition(storage,position);return position;}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('the real PdfPane hooks do not overwrite saved positions with initial 550px placeholders or a hidden viewport',async()=>{
 const storage=memory(),p=bookmark(storage);const raw=storage.getItem(model.pdfReadingStorageKey(p.key));
 const h=harness({storage,width:0,height:0,page:249,zoom:1.6});h.flush();assert.equal(storage.getItem(model.pdfReadingStorageKey(p.key)),raw);
 await h.load();h.flush();assert.equal(storage.getItem(model.pdfReadingStorageKey(p.key)),raw);assert.equal(h.reports.length,0);
 h.resize(390,700);near(h.host.scrollTop,p.top);near(h.host.scrollLeft,p.left);h.flush();assert.equal(model.readPdfReadingPosition(storage,p.key,279).top,p.top);h.dispose();
});
test('loading the visible pane restores before the first scroll report, without resetting to page start',async()=>{
 const storage=memory(),p=bookmark(storage);const h=harness({storage,page:249,zoom:1.6});
 assert.equal(model.readPdfReadingPosition(storage,p.key,279).top,p.top);await h.load();near(h.host.scrollTop,p.top);near(h.host.scrollLeft,p.left);assert.deepEqual(h.reports,[]);
 h.change({onNavigationHandled:()=>{}});h.settle();near(h.host.scrollTop,p.top);h.dispose();
});
test('a hidden explicit page jump remains pending, wins over the stored anchor, and acknowledges only when shown',async()=>{
 const storage=memory(),p=bookmark(storage);const h=harness({storage,width:0,height:0,page:249,zoom:1.6,navigationToken:7});await h.load();assert.deepEqual(h.acks,[]);
 h.resize(390,700);const layout=model.pageLayout(279,346,1.6,{});near(h.host.scrollTop,layout.offsets[248]+18);assert.deepEqual(h.acks,[7]);assert.equal(h.props.navigationToken,0);assert.notEqual(h.host.scrollTop,p.top);h.dispose();
});
test('quick-tool navigation to the same page deliberately returns to the page start',async()=>{
 const storage=memory(),p=bookmark(storage);const h=harness({storage,page:249,zoom:1.6});await h.load();near(h.host.scrollTop,p.top);
 h.quick(249);near(h.host.scrollTop,model.pageLayout(279,346,1.6,{}).offsets[248]+18);h.dispose();
});
test('last scroll followed immediately by hide and refresh keeps the precise new position even with a stale parent page',async()=>{
 const storage=memory(),h=harness({storage,page:20,zoom:1.6});await h.load();const layout=model.pageLayout(279,346,1.6,{}),target=layout.offsets[248]+layout.heights[248]*.43+18;
 h.scroll(target,120,{frames:false});h.resize(0,0);h.flush();const p=model.readPdfReadingPosition(storage,'d:thesis',279);assert.equal(p.page,249);near(p.top,target);h.dispose();
 const restored=harness({storage,page:20,zoom:1.6});await restored.load();assert.equal(restored.props.page,249);near(restored.host.scrollTop,target);near(restored.host.scrollLeft,120);restored.dispose();
});
test('orientation reflow followed by refresh keeps the same page fraction',async()=>{
 const storage=memory(),p=bookmark(storage);const h=harness({storage,page:249,zoom:1.6});await h.load();h.resize(844,390);
 const landscape=model.pageLayout(279,800,1.6,{}),expected=landscape.offsets[248]+landscape.heights[248]*.37+18;near(h.host.scrollTop,expected);h.flush();h.dispose();
 const next=harness({storage,width:844,height:390,page:249,zoom:1.6});await next.load();near(next.host.scrollTop,expected);near(next.host.scrollLeft,p.left*800/346);next.dispose();
});
test('switching documents flushes each position under its own key and returns to its exact anchor',async()=>{
 const storage=memory(),a=bookmark(storage),b=bookmark(storage,{key:'d:source-2',page:29,fraction:.62,left:60});
 const h=harness({storage,page:249,zoom:1.6});await h.load();near(h.host.scrollTop,a.top);
 h.change({id:'source-2',persistenceKey:'d:source-2',page:29});for(let i=0;i<3;i++){await new Promise(resolve=>setImmediate(resolve));h.settle();}near(h.host.scrollTop,b.top);near(h.host.scrollLeft,b.left);
 h.change({id:'thesis',persistenceKey:'d:thesis',page:249});for(let i=0;i<3;i++){await new Promise(resolve=>setImmediate(resolve));h.settle();}near(h.host.scrollTop,a.top);near(h.host.scrollLeft,a.left);h.dispose();
});
test('a first visit to a different reference does not inherit the preceding document horizontal offset',async()=>{
 const storage=memory(),a=bookmark(storage);const h=harness({storage,page:249,zoom:1.6});await h.load();near(h.host.scrollLeft,a.left);
 h.change({id:'unread-source',persistenceKey:'d:unread-source',page:27});for(let i=0;i<3;i++){await new Promise(resolve=>setImmediate(resolve));h.settle();}
 assert.equal(h.host.scrollLeft,0);near(h.host.scrollTop,model.pageLayout(279,346,1.6,{}).offsets[26]+18);h.dispose();
});

test('page fit shows the current full page and keeps fitting after height/width changes without changing document',async()=>{
 const h=harness({width:700,height:600,page:249,zoom:1.3});await h.load();h.scroll(model.pageLayout(279,656,1.3,{}).offsets[248]+300,50);h.fit('page');
 assert.equal(h.props.fitMode,'page');assert.equal(h.props.page,249);near(h.dimensions().width*728/515,560);
 h.resize(844,300);near(h.dimensions().width*728/515,260);assert.equal(h.props.page,249);h.flush();const saved=model.readPdfReadingPosition(h.storage,'d:thesis',279);assert.ok(saved);assert.ok(saved.zoom<.5);h.dispose();
 const restored=harness({storage:h.storage,width:844,height:300,page:249,zoom:saved.zoom,fitMode:'page'});await restored.load();near(restored.host.scrollTop,saved.top);near(restored.dimensions().width*728/515,260);restored.dispose();
});

test('width fit follows even a narrow reference pane and numeric zoom explicitly leaves fitting',async()=>{
 const h=harness({width:390,height:700,page:29,id:'source',zoom:1.45});await h.load();h.fit('width');near(h.dimensions().width,346);h.resize(170,500);near(h.dimensions().width,126);
 h.numeric(1.3);assert.equal(h.props.fitMode,null);near(h.dimensions().width,163.8);h.resize(230,500);near(h.dimensions().width,241.8);assert.equal(h.props.page,29);h.dispose();
});

test('external toolbar page-fit selection aligns the current page while a hidden initial fit waits for real dimensions',async()=>{
 const h=harness({width:0,height:0,page:20,fitMode:'page',zoom:.4});await h.load();assert.equal(h.props.zoom,.4);h.resize(700,500);near(h.dimensions().width*728/515,460);
 h.numeric(1.3);h.scroll(model.pageLayout(279,656,1.3,{}).offsets[19]+300);h.change({fitMode:'page'});const fitted=model.pageLayout(279,656,h.props.zoom,{});near(h.host.scrollTop,fitted.offsets[19]+18);assert.equal(h.props.page,20);h.dispose();
});

test('fit commit survives immediate hidden-pane reload without any animation frame or save timer',async()=>{
 for(const {width,height,page,id} of [{width:700,height:600,page:20,id:'thesis'},{width:390,height:700,page:27,id:'source'}])for(const fitMode of ['page','width']){
  const key='d:'+id,storage=memory(),h=harness({storage,width,height,page,id,zoom:1.3});await h.load();
  h.scroll(model.pageLayout(279,width-44,1.3,{}).offsets[page-1]+300,50);h.flush();
  h.fit(fitMode,{frames:false});const expected={top:h.host.scrollTop,left:h.host.scrollLeft,zoom:h.props.zoom};
  h.resize(0,0,{frames:false});h.flush({frames:false});
  const saved=model.readPdfReadingPosition(storage,key,279);near(saved.top,expected.top);near(saved.left,expected.left);near(saved.zoom,expected.zoom);h.dispose();
  const restored=harness({storage,width,height,page,id,zoom:expected.zoom,fitMode});await restored.load();near(restored.host.scrollTop,expected.top);near(restored.host.scrollLeft,expected.left);restored.dispose();
 }
});

test('a height-only resize before ResizeObserver cannot replace a committed page-fit anchor with clamped scroll',async()=>{
 const storage=memory(),h=harness({storage,width:700,height:600,page:279,fitMode:'page'});await h.load();h.flush();
 const saved=model.readPdfReadingPosition(storage,'d:thesis',279),raw=storage.getItem(model.pdfReadingStorageKey('d:thesis'));assert.ok(saved);
 h.resize(700,1800,{observe:false,frames:false});assert.ok(h.host.scrollTop<saved.top,'the taller viewport must clamp the old scroll range');h.flush({frames:false});
 assert.equal(storage.getItem(model.pdfReadingStorageKey('d:thesis')),raw,'do not capture a new-height scroll value against the old-height fit layout');h.dispose();
 const restored=harness({storage,width:700,height:1800,page:279,fitMode:'page',zoom:saved.zoom});await restored.load();
 const layout=model.pageLayout(279,656,restored.props.zoom,{}),expected=model.restorePdfReadingPosition(saved,layout);near(restored.host.scrollTop,Math.min(expected.top,layout.totalHeight+36-1800));restored.dispose();
});

test('page/width-fit resize preserves a gap anchor and immediate reload retains the committed resized position',async()=>{
 for(const [fitMode,width,height,nextWidth,nextHeight] of [['page',700,600,700,519],['page',390,700,844,390],['width',700,600,390,700],['width',390,700,844,390]]){
  const storage=memory(),h=harness({storage,width,height,page:20,fitMode});await h.load();
  const before=model.pageLayout(279,width-44,h.props.zoom,{}),top=before.offsets[19]-1e-10+18;h.scroll(top);h.flush();
  h.resize(nextWidth,nextHeight,{frames:false});const next=model.pageLayout(279,nextWidth-44,h.props.zoom,{}),expected=next.offsets[19]-1e-10+18;near(h.host.scrollTop,expected);
  h.resize(0,0,{frames:false});h.flush({frames:false});near(model.readPdfReadingPosition(storage,'d:thesis',279).top,expected);h.dispose();
  const restored=harness({storage,width:nextWidth,height:nextHeight,page:20,fitMode});await restored.load();near(restored.host.scrollTop,expected);restored.dispose();
 }
});

test('reflow retains the top-of-document padding inset instead of adding 18px',async()=>{
 for(const top of [0,7,18]){const h=harness({width:390,height:700,page:1});await h.load();h.scroll(top);h.resize(844,390);near(h.host.scrollTop,top);h.dispose();}
});

test('rounded page-fit start survives metadata-only layout recreation and immediate reload',async()=>{
 for(const scrollQuantum of [1,1/64]){
  const storage=memory(),h=harness({storage,width:700,height:519,page:20,fitMode:'page',scrollQuantum});await h.load();near(h.host.scrollTop,9575);
  h.change({pageSizes:[{page:20,width:515,height:728}]},{frames:false});near(h.host.scrollTop,9575);h.flush({frames:false});h.dispose();
  const restored=harness({storage,width:700,height:519,page:20,fitMode:'page',scrollQuantum});await restored.load();near(restored.host.scrollTop,9575);restored.dispose();
 }
});

test('metadata rendered before a pending height resize cannot commit the clamped intermediate anchor',async()=>{
 const h=harness({width:700,height:600,page:279,fitMode:'page'});await h.load();h.flush();const saved=model.readPdfReadingPosition(h.storage,'d:thesis',279);
 h.resize(700,1800,{observe:false,frames:false});h.change({pageSizes:[{page:1,width:600,height:400}]},{frames:false});h.resize(700,1800,{frames:false});
 const layout=model.pageLayout(279,656,h.props.zoom,{1:{width:600,height:400}}),expected=model.restorePdfReadingPosition(saved,layout);near(h.host.scrollTop,Math.min(expected.top,layout.totalHeight+36-1800));h.dispose();
});
