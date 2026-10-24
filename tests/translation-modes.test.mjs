import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as model from '../src/translation-reading.ts';
const require=createRequire(import.meta.url),registry=JSON.parse(readFileSync(new URL('../src/source-translations.json',import.meta.url),'utf8'));
const code=ts.transpileModule(readFileSync(new URL('../src/parallel-source-reader.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const memory=()=>{const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};
const sample={version:1,block:'b2',page:2,fraction:.4,top:1400,left:40,width:400,scrollWidth:800,scrollHeight:4000};
function harness({store=memory(),width=400,height=500,loaded=true,page=2,token=0,sync=false,component=false}={}){
 const hooks=[],layouts=[],effects=[],observers=new Set(),timers=new Map(),reports=[],compareReports=[],preserveNavigation={current:null};let index=0,dirty=true,tree,result,id=0;
 const win=Object.assign(new EventTarget(),{innerWidth:390,localStorage:store}),document=Object.assign(new EventTarget(),{hidden:false,baseURI:'https://example.invalid/'});
 const host={clientWidth:width,clientHeight:height,scrollTop:0,scrollLeft:0,scrollWidth:800,scrollHeight:4000,firstElementChild:{},getBoundingClientRect:()=>({top:0,bottom:host.clientHeight}),querySelectorAll:()=>rows};
 let unit=1000;
 const rows=[1,2,3,4].map(n=>({dataset:{readingBlock:'b'+n,readingPage:String(n)},getBoundingClientRect:()=>({top:(n-1)*unit-host.scrollTop,bottom:n*unit-host.scrollTop,height:unit})}));
 const props={loaded,page,navigationToken:token,syncPage:sync},same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const useEffect=queue=>(fn,deps)=>{const i=index++,old=hooks[i];if(!old||!same(old.deps,deps)){hooks[i]={deps,cleanup:old?.cleanup};queue.push(()=>{hooks[i].cleanup?.();hooks[i].cleanup=fn();});}};
 const react={...React,useRef:initial=>{const i=index++;return hooks[i]??={current:initial};},useState:initial=>{const i=index++;if(!(i in hooks))hooks[i]={value:typeof initial==='function'?initial():initial};return [hooks[i].value,next=>{const value=typeof next==='function'?next(hooks[i].value):next;if(!Object.is(value,hooks[i].value)){hooks[i].value=value;dirty=true;}}];},useLayoutEffect:useEffect(layouts),useEffect:useEffect(effects)};
 function Divider(){return null;}
 const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,window:win,document,URL,setTimeout:fn=>{const n=++id;timers.set(n,fn);return n;},clearTimeout:n=>timers.delete(n),fetch:()=>new Promise(()=>{}),ResizeObserver:class{constructor(fn){this.fn=fn;}observe(){observers.add(this.fn);}disconnect(){observers.delete(this.fn);}},require:name=>name==='react'?react:name==='./translation-reading'?model:name==='./source-translations.json'?{default:registry}:name==='./translation-model'?{}:name==='./reader-controls'?{__esModule:true,default:({children})=>children}:name==='./pane-resizer'?{__esModule:true,default:Divider}:name.endsWith('.css')?{}:require(name)});
 const entry=registry.sources[0],child=React.createElement('pdf-sentinel',{page:29,zoom:1.45}),key=component?'data:'+entry.sourceId+':'+entry.sourceSha256:'data:source:sha';
 function render(){index=0;dirty=false;if(component){tree=module.exports.TranslationReader({sourceId:entry.sourceId,entry,page:29,onPageChange:n=>reports.push(n),onComparePage:n=>compareReports.push(n),persistenceKey:'data:'+entry.sourceId,children:child});}else result=module.exports.useTranslationPosition({current:host},key,'translation',4,props.loaded,props.page,n=>{reports.push(n);props.page=n;dirty=true;},props.syncPage,props.navigationToken,preserveNavigation);while(layouts.length)layouts.shift()();while(effects.length)effects.shift()();}
 function settle(){let tries=0;while(dirty){assert.ok(++tries<30,'must settle');render();}}
 function nodes(){const values=[];function walk(n){if(!n||typeof n!=='object')return;values.push(n);React.Children.forEach(n.props?.children,walk);}walk(tree);return values;}
 function change(next){Object.assign(props,next);dirty=true;settle();}
 function resize(w,h,u=unit){host.clientWidth=w;host.clientHeight=h;unit=u;host.scrollHeight=unit*4;host.scrollWidth=w*2;for(const fn of observers)fn();settle();}
 function scroll(top,left=host.scrollLeft){host.scrollTop=top;host.scrollLeft=left;result.onScroll();settle();}
 function flush(){win.dispatchEvent(new Event('pagehide'));settle();}
 function dispose(){for(const h of hooks)h?.cleanup?.();}
 const label=n=>React.Children.toArray(n.props.children).map(c=>typeof c==='object'?'':String(c)).join('');
 settle();return {host,store,key,props,reports,compareReports,preserveNavigation,alignPage:p=>{result.alignPage(p);settle();},change,resize,scroll,flush,dispose,nodes,label,render:()=>{dirty=true;settle();},click:text=>{nodes().find(n=>n.type==='button'&&label(n)===text).props.onClick();dirty=true;settle();},module,child};
}

test('document-specific three-mode/layout settings survive reload without sharing split axes',()=>{
 const store=memory(),value={version:1,mode:'translation',layout:'vertical',splitX:64,splitY:38};model.writeTranslationView(store,'docA',value);
 assert.deepEqual(model.readTranslationView(store,'docA'),value);assert.equal(model.readTranslationView(store,'docB').mode,'parallel');assert.equal(model.readTranslationView(store,'docB',true).layout,'vertical');
 store.setItem(model.translationViewKey('bad'),JSON.stringify({...value,mode:'unknown',splitX:999}));assert.equal(model.readTranslationView(store,'bad').mode,'parallel');assert.equal(model.readTranslationView(store,'bad').splitX,50);
 assert.doesNotThrow(()=>model.writeTranslationView({setItem(){throw Error('blocked')},getItem(){throw Error('blocked')}},'x',value));
});

test('all three modes retain the same PDF child and text pane, with a usable actual parallel layout',()=>{
 const h=harness({component:true});for(const [label,mode] of [['원문','original'],['번역','translation'],['병기','parallel'],['원문','original']]){
  h.click(label);assert.equal(h.nodes()[0].props['data-translation-mode'],mode);assert.equal(h.nodes().filter(n=>n.type==='pdf-sentinel').length,1);assert.equal(h.nodes().find(n=>n.type==='pdf-sentinel'),h.child);
  assert.equal(h.nodes().find(n=>n.props?.className==='parallel-original').props.hidden,mode==='translation');assert.equal(h.nodes().find(n=>n.props?.className==='translation-pane').props.hidden,mode==='original');
 }
 h.click('병기');h.click('좌우');assert.match(h.nodes().find(n=>String(n.props?.className).startsWith('parallel-source ')).props.className,/layout-horizontal/);h.click('상하');
 const separator=h.nodes().find(n=>n.props?.label==='원문과 번역 높이 조절');assert.equal(separator.props.axis,'y');separator.props.onChange(38);h.render();assert.equal(model.readTranslationView(h.store,h.key).splitY,38);
 const restored=harness({component:true,store:h.store});assert.equal(restored.nodes()[0].props['data-translation-mode'],'parallel');assert.equal(restored.nodes().find(n=>n.props?.label==='원문과 번역 높이 조절').props.value,38);
 const unavailable=h.module.exports.default({sourceId:'no-translation',page:1,onPageChange(){},children:h.child});assert.equal(unavailable.props.className,'source-reader-single');assert.equal(unavailable.props.children,h.child);h.dispose();restored.dispose();
});

test('hidden/asynchronously loaded translation restores exact position without overwriting it with zero',()=>{
 const store=memory(),key='data:source:sha';store.setItem(model.translationPositionKey(key,'translation'),JSON.stringify(sample));const original=store.getItem(model.translationPositionKey(key,'translation'));
 const h=harness({store,width:0,height:0,loaded:false});h.flush();assert.equal(store.getItem(model.translationPositionKey(key,'translation')),original);h.change({loaded:true});h.flush();assert.equal(store.getItem(model.translationPositionKey(key,'translation')),original);
 h.resize(400,500);assert.equal(h.host.scrollTop,1400);assert.equal(h.host.scrollLeft,40);assert.deepEqual(h.reports,[]);h.dispose();
});

test('translation mode changes and reflow preserve the block fraction, and last scroll flush survives reload',()=>{
 const store=memory(),h=harness({store});h.scroll(1440,70);h.change({syncPage:true});assert.equal(h.host.scrollTop,1440);h.resize(200,400,1800);assert.equal(h.host.scrollTop,2592);assert.equal(h.host.scrollLeft,35);
 h.scroll(4321,55);h.resize(0,0);h.flush();h.dispose();const restored=harness({store,width:200,height:400});restored.resize(200,400,1800);assert.equal(restored.host.scrollTop,4321);assert.equal(restored.host.scrollLeft,55);restored.dispose();
});

test('explicit navigation while hidden wins over the text bookmark, including a repeated same-page request',()=>{
 const store=memory(),key='data:source:sha';store.setItem(model.translationPositionKey(key,'translation'),JSON.stringify(sample));const h=harness({store,width:0,height:0,token:7,page:3});h.change({navigationToken:0});h.resize(400,500);assert.equal(h.host.scrollTop,2000);
 h.scroll(2400);h.change({navigationToken:8,page:3});assert.equal(h.host.scrollTop,2000);h.dispose();
});

test('translation-only scrolling preserves the original page while parallel scrolling reports a shared page',()=>{
 const h=harness();h.scroll(2400);assert.deepEqual(h.reports,[]);h.change({syncPage:true});assert.equal(h.host.scrollTop,2400);h.scroll(3400);assert.deepEqual(h.reports,[4]);h.change({page:2});assert.equal(h.host.scrollTop,1000);h.dispose();
});

test('returning from translation-only compares its latest page while the initiating translation offset is preserved',()=>{
 const store=memory(),entry=registry.sources[0],key='data:'+entry.sourceId+':'+entry.sourceSha256;
 model.writeTranslationView(store,key,{version:1,mode:'translation',layout:'horizontal',splitX:50,splitY:50});store.setItem(model.translationPositionKey(key,'translation'),JSON.stringify({...sample,page:25}));
 const view=harness({component:true,store});view.click('병기');assert.deepEqual(view.compareReports,[25]);assert.deepEqual(view.reports,[]);view.dispose();
 const position=harness();position.scroll(2440,60);position.preserveNavigation.current=3;position.change({page:3,navigationToken:11,syncPage:true});assert.equal(position.host.scrollTop,2440);assert.equal(position.host.scrollLeft,60);
 position.change({navigationToken:12});assert.equal(position.host.scrollTop,2000);position.dispose();
});

test('returning from original-only aligns a different translation page, but keeps an offset on the same page',()=>{
 const h=harness();h.scroll(1440,60);h.alignPage(2);assert.equal(h.host.scrollTop,1440);h.alignPage(3);assert.equal(h.host.scrollTop,2000);h.dispose();
});

test('malformed and oversized saved text bookmarks are rejected, and narrow CSS never substitutes a one-sided mobile tab',()=>{
 assert.ok(model.parseTranslationPosition(JSON.stringify(sample),4));for(const bad of [{...sample,block:''},{...sample,page:5},{...sample,fraction:-1},{...sample,width:0}])assert.equal(model.parseTranslationPosition(JSON.stringify(bad),4),null);
 assert.equal(model.parseTranslationPosition(' '.repeat(5000),4),null);
 const css=readFileSync(new URL('../src/parallel-source-reader.css',import.meta.url),'utf8');assert.doesNotMatch(css,/mobile-original.*translation-pane|mobile-translation.*parallel-original/);assert.match(css,/layout-vertical[^}]*grid-template-rows/);
 const readingCSS=readFileSync(new URL('../src/reading-controls.css',import.meta.url),'utf8');assert.doesNotMatch(readingCSS,/view-hide-tools[^}]*translation-switchbar/);
});
