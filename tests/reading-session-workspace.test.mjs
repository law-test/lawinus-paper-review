import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as paneLayout from '../src/four-pane-size.ts';
import * as readingView from '../src/reading-view.ts';
import * as mobileMenu from '../src/mobile-menu-swipe.ts';
import * as readingSession from '../src/reading-session.ts';
const require=createRequire(import.meta.url),source=readFileSync(new URL('../src/review-workspace.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const paragraphs=[{id:'P0283',text:'원문',page:20,printed:1,heading:false,kind:'paragraph',rects:[],order:283}];
const fixture={meta:{pageCount:279},pages:[],sources:[{id:'a',kind:'pdf',title:'원전 A',pages:220},{id:'b',kind:'pdf',title:'원전 B',pages:48}],notes:[{id:'fn-001',number:1,page:20,text:'각주 원문',sourceRefs:[{sourceId:'a'},{sourceId:'b'}],clickTargets:[],noteHighlights:[]}]};
function PdfPane(){return null;}function WebManuscript(){return null;}
const empty={__esModule:true,default:()=>null};
function harness(saved){
 const values=new Map(),writes=[];if(saved)values.set(readingSession.readingSessionKey('human-a'),JSON.stringify(saved));
 const local={getItem:key=>values.get(key)||null,setItem:(key,value)=>{writes.push({key,value});values.set(key,value);}};
 let states=[],refs=[],cursor=0,refIndex=0,effects=[],tree,resolveManifest;
 const pendingManifest=new Promise(resolve=>{resolveManifest=resolve;});
 const module={exports:{}},dependencies={
  './four-pane-size':paneLayout,'./reading-view':readingView,'./mobile-menu-swipe':mobileMenu,'./reading-session':readingSession,
  './paragraph-catalog.json':{default:{paragraphs}},'./revision-proposals.json':{default:{items:[]}},
  './proposal-indicators':{buildProposalIndicators:()=>({})},'./pdf-viewer-model':{footnoteTargets:()=>[]},
  './web-manuscript':{...empty,default:WebManuscript,effectiveManuscriptEdits:()=>({}),citationContextWasEdited:()=>false,manuscriptModeAfterRefresh:(mode,chose,count)=>!chose&&count?'body':mode},
  './pdf-viewer':{...empty,default:PdfPane},'./parallel-source-reader':{...empty,translationEntries:[]},
  './citation-model':{citedSourceRefs:note=>note.sourceRefs||[],citedPages:()=>[],citationHighlights:()=>[],citationStartPage:()=>27},
  './text-size-control':{TextSizeControl:()=>null},'./document-alignment':{useDocumentAlignment:()=>{}},
  './review-api':{api:path=>path==='/api/manifest'?pendingManifest:Promise.resolve(path==='/api/profile'?{}:{notes:[]}),loadReviewConfig:()=>Promise.resolve({datasetId:'human-a'}),initializeReviewSession:()=>Promise.resolve({user:{}}),assetUrl:()=>''},
 };
 vm.runInNewContext(compiled,{module,exports:module.exports,window:{innerWidth:390,innerHeight:844,localStorage:local},require:id=>{
  if(id==='react')return {...React,useState:initial=>{const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];},useRef:initial=>refs[refIndex++]??=( {current:initial}),useMemo:fn=>fn(),useEffect:(fn,deps)=>effects.push({fn,deps})};
  if(id in dependencies)return dependencies[id];if(id.startsWith('.'))return id.endsWith('.css')?{}:id.endsWith('.json')?{default:{}}:empty;return require(id);
 }});
 function render(){cursor=0;refIndex=0;effects=[];tree=module.exports.default();return tree;}
 function nodes(){const all=[];function walk(node){if(!node||typeof node!=='object')return;all.push(node);React.Children.forEach(node.props?.children,walk);}walk(tree);return all;}
 function persist(){effects.find(e=>e.fn.toString().includes('readingSnapshot.current')&&e.deps?.length>1)?.fn();}
 async function boot(){effects.find(e=>e.fn.toString().includes('loadReviewConfig'))?.fn();resolveManifest(fixture);await new Promise(resolve=>setTimeout(resolve,0));render();}
 const label=node=>React.Children.toArray(node.props?.children).map(c=>typeof c==='object'?label(c):String(c)).join('');
 render();return {render,nodes,persist,boot,writes,values,label,pdf:id=>nodes().find(n=>n.type===PdfPane&&n.props.id===id),body:()=>nodes().find(n=>n.type===WebManuscript)};
}
const saved={schema:1,datasetId:'human-a',thesis:{page:249,zoom:1.15},sources:{a:{page:199,zoom:1.3},b:{page:21,zoom:1.6}},sourceId:'a',activeNote:'fn-001',manuscriptMode:'pdf',mobilePane:'source',tab:'source',paragraphId:'',proposalId:'',readingView:{focus:false,header:true,tools:true,footnotes:true},sidebarOpen:false,metadataOpen:true};
test('workspace does not save initial defaults while loading and renders the restored values together',async()=>{
 const h=harness(saved);h.persist();assert.equal(h.writes.length,0);await h.boot();
 assert.equal(h.pdf('thesis').props.page,249);assert.equal(h.pdf('thesis').props.zoom,1.15);assert.equal(h.pdf('thesis').props.persistenceKey,'human-a:thesis');
 assert.equal(h.pdf('a').props.page,199);assert.equal(h.pdf('a').props.zoom,1.3);assert.equal(h.pdf('a').props.navigationToken,0);
 assert.match(h.render().props.className,/mobile-show-source/);h.persist();assert.deepEqual(JSON.parse(h.values.get(readingSession.readingSessionKey('human-a'))),saved);
});
test('restored body mode and dataset-specific precise-position key reach the body viewer',async()=>{
 const h=harness({...saved,manuscriptMode:'body',mobilePane:'thesis'});await h.boot();
 assert.equal(h.pdf('thesis'),undefined);assert.equal(h.body().props.page,249);assert.equal(h.body().props.persistenceKey,'human-a:body');h.persist();
 assert.equal(JSON.parse(h.values.get(readingSession.readingSessionKey('human-a'))).manuscriptMode,'body');
});
test('the user collapsed reading layout restores before documents appear without saving a short-screen override',async()=>{
 const view={focus:true,header:true,tools:false,footnotes:false},h=harness({...saved,readingView:view,metadataOpen:false,sidebarOpen:false});await h.boot();
 assert.match(h.render().props.className,/metadata-collapsed reading-focus/);h.persist();
 const stored=JSON.parse(h.values.get(readingSession.readingSessionKey('human-a')));assert.deepEqual(stored.readingView,view);assert.equal(stored.metadataOpen,false);assert.equal(stored.sidebarOpen,false);
});
test('last document page reports are persisted synchronously before React can render during pagehide',async()=>{
 const h=harness(saved);await h.boot();h.persist();
 h.pdf('thesis').props.onPageChange(250);h.pdf('a').props.onPageChange(200);
 const stored=JSON.parse(h.values.get(readingSession.readingSessionKey('human-a')));
 assert.equal(stored.thesis.page,250);assert.equal(stored.sources.a.page,200);assert.equal(stored.thesis.zoom,1.15);assert.equal(stored.sources.a.zoom,1.3);
});
test('explicit PDF/body mode changes request the current page rather than reviving a different old view page',async()=>{
 const h=harness({...saved,manuscriptMode:'body',mobilePane:'thesis'});await h.boot();h.body().props.onPageChange(250);h.render();
 const button=h.nodes().find(n=>n.type==='button'&&h.label(n)==='원본 PDF');assert.ok(button);button.props.onClick();h.render();
 assert.equal(h.pdf('thesis').props.page,250);assert.ok(h.pdf('thesis').props.navigationToken>0);
});
test('reference switches retain per-document values while an explicit footnote click wins over restored position',async()=>{
 const h=harness(saved);await h.boot();const click=text=>{const button=h.nodes().find(n=>n.type==='button'&&h.label(n)===text);assert.ok(button);button.props.onClick();h.render();};
 click('2. 원전 B');assert.equal(h.pdf('b').props.page,21);assert.equal(h.pdf('b').props.zoom,1.6);h.pdf('b').props.onPageChange(24);h.pdf('b').props.onZoomChange(1.45);h.render();
 click('1. 원전 A');assert.equal(h.pdf('a').props.page,199);assert.equal(h.pdf('a').props.zoom,1.3);
 h.pdf('thesis').props.onTarget('fn-001');h.render();assert.equal(h.pdf('a').props.page,27);assert.ok(h.pdf('a').props.navigationToken>0);const token=h.pdf('a').props.navigationToken;
 h.pdf('a').props.onNavigationHandled(token-1);h.render();assert.equal(h.pdf('a').props.navigationToken,token);h.pdf('a').props.onNavigationHandled(token);h.render();assert.equal(h.pdf('a').props.navigationToken,0);
 click('2. 원전 B');assert.equal(h.pdf('b').props.page,24);assert.equal(h.pdf('b').props.zoom,1.45);assert.equal(h.pdf('b').props.navigationToken,0);
 h.persist();const stored=JSON.parse(h.values.get(readingSession.readingSessionKey('human-a')));assert.deepEqual(stored.sources.b,{page:24,zoom:1.45});assert.equal(stored.thesis.page,249);
});
