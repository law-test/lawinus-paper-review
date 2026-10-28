import * as faqModel from '../src/thesis-faq-model.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as paneLayout from '../src/four-pane-size.ts';
import * as workspaceLayout from '../src/workspace-layout.ts';
import * as readingView from '../src/reading-view.ts';
import * as mobileMenu from '../src/mobile-menu-swipe.ts';
import * as readingSession from '../src/reading-session.ts';
import * as workspaceTools from '../src/workspace-tools.ts';
const require=createRequire(import.meta.url),source=readFileSync(new URL('../src/review-workspace.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const paragraphs=[{id:'P0283',text:'원문',page:20,printed:1,heading:false,kind:'paragraph',rects:[],order:283}];
const fixture={datasetId:'human-a',meta:{pageCount:279},pages:[{page:249,printedPage:'231'}],sources:[{id:'a',kind:'pdf',title:'원전 A',pages:220},{id:'b',kind:'pdf',title:'원전 B',pages:48}],notes:[{id:'fn-001',number:1,page:20,text:'각주 원문',sourceRefs:[{sourceId:'a'},{sourceId:'b'}],clickTargets:[],noteHighlights:[]}]};
function PdfPane(){return null;}function WebManuscript(){return null;}function ParallelSourceReader(){return null;}function ReadingControls(){return null;}function PaneResizer(){return null;}function WorkspaceLaunchers(){return null;}
const translations=[{sourceId:'t-german',kind:'text',noteIds:['fn-001'],title:'독일어 원문'}];
const empty={__esModule:true,default:()=>null};
const edition={id:'human73',datasetId:'human-a',label:'인간73',date:'2026. 10. 26.',pages:279,footnotes:1,toc:{entries:[]}};
function harness(saved,width=390,height=844,layout,entry={search:'',hash:''}){
 const popupCalls=[],values=new Map(),writes=[];if(layout)values.set(workspaceLayout.WORKSPACE_LAYOUT_KEY,JSON.stringify(layout));if(saved)values.set(readingSession.readingSessionKey('human-a'),JSON.stringify(saved));
 const local={getItem:key=>values.get(key)||null,setItem:(key,value)=>{writes.push({key,value});values.set(key,value);}};
 let states=[],refs=[],cursor=0,refIndex=0,effects=[],tree,resolveManifest;
 const pendingManifest=new Promise(resolve=>{resolveManifest=resolve;});
 const module={exports:{}},dependencies={
  './thesis-faq-model':faqModel,
  './manuscript-editions':{editionParagraphs:()=>paragraphs,editionProposals:()=>[],editionDownloadPath:(id,format)=>`./editions/${id}/manuscript.${format}`},
  './workspace-tools':workspaceTools,'./workspace-tool-popups':{useWorkspaceToolPopups:()=>({openTool:tool=>popupCalls.push(tool),layer:null})},'./workspace-launchers':{...empty,default:WorkspaceLaunchers},
  './legal-links':{useLegalLinks:()=>()=>{},LegalText:({text})=>React.createElement(React.Fragment,null,text)},
  './source-text':{__esModule:true,default:({text})=>React.createElement(React.Fragment,null,text)},
  './citation-link-model':{citationPdfTargets:()=>[]},'./legal-pdf-targets.json':{default:{targets:[],mentions:{}}},
  './four-pane-size':paneLayout,'./workspace-layout':workspaceLayout,'./reading-view':readingView,'./mobile-menu-swipe':mobileMenu,'./reading-session':readingSession,
  './paragraph-catalog.json':{default:{paragraphs}},'./revision-proposals.json':{default:{items:[]}},
  './proposal-indicators':{buildProposalIndicators:()=>({})},'./pdf-viewer-model':{footnoteTargets:()=>[]},
  './web-manuscript':{...empty,default:WebManuscript,effectiveManuscriptEdits:()=>({}),citationContextWasEdited:()=>false,manuscriptModeAfterRefresh:(mode,chose,count)=>!chose&&count?'body':mode},
  './pdf-viewer':{...empty,default:PdfPane},'./reading-controls':{...empty,default:ReadingControls},'./pane-resizer':{...empty,default:PaneResizer},'./parallel-source-reader':{...empty,default:ParallelSourceReader,translationEntries:translations},
  './citation-model':{citedSourceRefs:note=>note.sourceRefs||[],citedPages:()=>[],citationHighlights:()=>[],citationStartPage:()=>27},
  './text-size-control':{TextSizeControl:()=>null},'./document-alignment':{useDocumentAlignment:()=>{}},
  './review-api':{api:path=>path==='/api/manifest'?pendingManifest:Promise.resolve(path==='/api/profile'?{}:{notes:[]}),loadReviewConfig:()=>Promise.resolve({datasetId:'human-a'}),initializeReviewSession:()=>Promise.resolve({user:{}}),assetUrl:()=>''},
 };
 vm.runInNewContext(compiled,{module,exports:module.exports,window:{location:{search:entry.search||'',hash:entry.hash||''},innerWidth:width,innerHeight:height,localStorage:local},require:id=>{
  if(id==='react')return {...React,useState:initial=>{const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];},useRef:initial=>refs[refIndex++]??=( {current:initial}),useMemo:fn=>fn(),useEffect:(fn,deps)=>effects.push({fn,deps})};
  if(id in dependencies)return dependencies[id];if(id.startsWith('.'))return id.endsWith('.css')?{}:id.endsWith('.json')?{default:{}}:empty;return require(id);
 }});
 function render(){cursor=0;refIndex=0;effects=[];tree=module.exports.ReviewWorkspaceEdition({edition,onEdition:()=>{},toolPopups:dependencies['./workspace-tool-popups'].useWorkspaceToolPopups()});return tree;}
 function nodes(){const all=[];function walk(node){if(!node||typeof node!=='object')return;all.push(node);React.Children.forEach(node.props?.children,walk);}walk(tree);return all;}
 function persist(){effects.find(e=>e.fn.toString().includes('readingSnapshot.current')&&e.deps?.length>1)?.fn();}
 async function boot(){effects.find(e=>e.fn.toString().includes('loadReviewConfig'))?.fn();resolveManifest(fixture);await new Promise(resolve=>setTimeout(resolve,0));render();}
 const label=node=>React.Children.toArray(node.props?.children).map(c=>typeof c==='object'?label(c):String(c)).join('');
 render();return {popupCalls,render,nodes,persist,persistLayout:()=>effects.find(e=>e.fn.toString().includes("saveWorkspaceLayout"))?.fn(),applyDeepLink:()=>effects.find(e=>e.fn.toString().includes('reviewDeepLink'))?.fn(),boot,writes,values,label,pdf:id=>nodes().find(n=>n.type===PdfPane&&n.props.id===id),body:()=>nodes().find(n=>n.type===WebManuscript)};
}
const saved={schema:1,datasetId:'human-a',thesis:{page:249,zoom:1.15},sources:{a:{page:199,zoom:1.3},b:{page:21,zoom:1.6}},sourceId:'a',textTranslation:'',activeNote:'fn-001',manuscriptMode:'pdf',mobilePane:'source',tab:'source',paragraphId:'',proposalId:'',readingView:{focus:false,header:true,tools:true,footnotes:true},sidebarOpen:false,metadataOpen:true};

test('footer uses the actual edition printed-page label and never derives an old offset',async()=>{
 const h=harness(saved);await h.boot();
 assert.ok(h.nodes().some(node=>node.type==='span'&&h.label(node)==='PDF 249쪽 · 인쇄 231면'));
 h.pdf('thesis').props.onPageChange(250);h.render();
 assert.ok(h.nodes().some(node=>node.type==='span'&&h.label(node)==='PDF 250쪽'));
});
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


test('German supplemental original survives initial restore and menu round trips; explicit source changes clear it',async()=>{
 const h=harness({...saved,textTranslation:'t-german'});await h.boot();
 const reader=()=>h.nodes().find(n=>n.type===ParallelSourceReader&&n.props.sourceId==='t-german');
 assert.ok(reader());assert.equal(reader().props.persistenceKey,'human-a:t-german');assert.equal(h.pdf('a'),undefined);
 h.persist();assert.equal(JSON.parse(h.values.get(readingSession.readingSessionKey('human-a'))).textTranslation,'t-german');
 const menu=h.nodes().find(n=>n.type==='button'&&h.label(n).startsWith('▧검토 메모'));menu.props.onClick();h.render();assert.ok(reader());
 const sourceMenu=h.nodes().find(n=>n.type==='button'&&h.label(n)==='↔원전 대조');sourceMenu.props.onClick();h.render();assert.ok(reader());
 const source=h.nodes().find(n=>n.type==='button'&&h.label(n)==='1. 원전 A');source.props.onClick();h.render();assert.equal(reader(),undefined);assert.equal(h.pdf('a').props.page,199);
});


test('switching document orientation and resizing panels preserve both readers and explicit navigation state',async()=>{
 const h=harness(saved,1701,818);await h.boot();
 const controls=()=>h.nodes().find(n=>n.type===ReadingControls);
 controls().props.onLayout('rows');h.render();assert.match(h.render().props.className,/documents-stacked/);
 const split=()=>h.nodes().find(n=>n.type===PaneResizer&&n.props.className==='split-divider thesis-source-divider');
 assert.equal(split().props.axis,'y');split().props.onChange(63);h.render();
 const grid=h.nodes().find(n=>n.type==='div'&&n.props.className==='split-workspace four-pane-workspace');assert.match(grid.props.style['--document-rows'],/63fr/);
 for(const [label,value] of [['상단 메뉴와 문서 영역 높이 조절',95],['문서와 하단 각주 목록 높이 조절',100],['각주 설명과 편집 영역 높이 조절',40],['검토 메뉴와 목차 높이 조절',160]]){
  const resize=h.nodes().find(n=>n.type===PaneResizer&&n.props.label===label);if(resize){resize.props.onChange(value);h.render();}
 }
 assert.equal(h.pdf('thesis').props.page,249);assert.equal(h.pdf('thesis').props.zoom,1.15);assert.equal(h.pdf('a').props.page,199);assert.equal(h.pdf('a').props.zoom,1.3);assert.equal(h.pdf('thesis').props.navigationToken,0);assert.equal(h.pdf('a').props.navigationToken,0);
 controls().props.onResetSizes();h.render();assert.ok(!h.render().props.className.includes('documents-stacked'));assert.equal(split().props.axis,'x');assert.equal(h.pdf('thesis').props.page,249);assert.equal(h.pdf('a').props.page,199);
});
test('saved desktop stacking leaves the mobile single-document tabs intact without discarding layout preferences',async()=>{
 const h=harness(saved,390,844,{...workspaceLayout.DEFAULT_WORKSPACE_LAYOUT,orientation:'rows',rowSplit:63});await h.boot();
 assert.ok(!h.render().props.className.includes('documents-stacked'));assert.match(h.render().props.className,/mobile-show-source/);
 const controls=h.nodes().find(n=>n.type===ReadingControls);assert.equal(controls.props.layout,'rows');assert.equal(controls.props.mobile,true);
 assert.equal(h.pdf('a').props.page,199);assert.equal(h.pdf('thesis').props.page,249);
});


test('the sidebar heading and menu keep their natural combined height until explicitly resized, and reset restores it',async()=>{
 const h=harness({...saved,sidebarOpen:true},1701,900);await h.boot();
 const menu=()=>h.nodes().find(n=>n.type==='div'&&n.props.className==='sidebar-controls');assert.equal(menu().props.style,undefined);
 const resize=h.nodes().find(n=>n.type===PaneResizer&&n.props.className==='sidebar-toc-divider');assert.ok(resize);resize.props.onChange(180);h.render();assert.equal(menu().props.style.height,180);
 h.nodes().find(n=>n.type===ReadingControls).props.onResetSizes();h.render();assert.equal(menu().props.style,undefined);
 const css=readFileSync(new URL('../src/workspace-layout.css',import.meta.url),'utf8');assert.match(css,/workspace-sidebar>\.sidebar-controls[^}]*flex-shrink:0/);assert.doesNotMatch(css,/workspace-sidebar>\.sidebar-controls[^}]*flex-shrink:1/);
});

test('all four upper regions collapse independently without changing either document or its reading session',async()=>{
 const h=harness({...saved,sidebarOpen:true},1701,900);await h.boot();
 for(const className of ['chrome-divider','sidebar-toc-divider','thesis-controls','source-controls']){
  const control=h.nodes().find(n=>n.props.className===className);assert.ok(control,className);control.props.onChange(0);h.render();
 }
 assert.equal(h.nodes().find(n=>n.props.className==='workspace-chrome').props.style.height,0);
 assert.equal(h.nodes().find(n=>n.props.className==='sidebar-controls').props.style.height,0);
 assert.equal(h.nodes().find(n=>n.props.className==='thesis-controls').props.height,0);
 assert.equal(h.nodes().find(n=>n.props.className==='source-controls').props.height,0);
 assert.equal(h.pdf('thesis').props.page,249);assert.equal(h.pdf('a').props.page,199);
 assert.equal(h.pdf('thesis').props.navigationToken,0);assert.equal(h.pdf('a').props.navigationToken,0);
 h.persistLayout();const persisted=JSON.parse(h.values.get(workspaceLayout.WORKSPACE_LAYOUT_KEY));
 for(const key of ['headerHeight','sidebarMenuHeight','thesisToolsHeight','sourceToolsHeight'])assert.equal(persisted[key],0);
 const fresh=harness({...saved,sidebarOpen:true},1701,900,persisted);await fresh.boot();
 assert.equal(fresh.nodes().find(n=>n.props.className==='thesis-controls').props.height,0);
 assert.equal(fresh.nodes().find(n=>n.props.className==='source-controls').props.height,0);
 const restored=fresh.nodes().find(n=>n.props.className==='thesis-controls');restored.props.onChange(120);fresh.render();
 assert.equal(fresh.nodes().find(n=>n.props.className==='thesis-controls').props.height,120);
 assert.equal(fresh.pdf('thesis').props.page,249);assert.equal(fresh.pdf('a').props.page,199);
});


test('PDF fit modes restore per document, survive computed zoom reports and clear only on numeric zoom',async()=>{
 const h=harness({...saved,thesis:{page:249,zoom:.45,fitMode:'page'},sources:{a:{page:199,zoom:1,fitMode:'width'},b:{page:21,zoom:1.6,fitMode:'page'}}});await h.boot();
 assert.equal(h.pdf('thesis').props.fitMode,'page');assert.equal(h.pdf('a').props.fitMode,'width');
 h.pdf('thesis').props.onZoomResolved(.38);h.pdf('a').props.onZoomResolved(.96);h.render();h.persist();
 let state=JSON.parse(h.values.get(readingSession.readingSessionKey('human-a')));assert.equal(state.thesis.zoom,.38);assert.equal(state.thesis.fitMode,'page');assert.equal(state.sources.a.fitMode,'width');
 h.pdf('thesis').props.onZoomChange(1.3);h.render();h.persist();state=JSON.parse(h.values.get(readingSession.readingSessionKey('human-a')));assert.equal(state.thesis.zoom,1.3);assert.equal(state.thesis.fitMode,undefined);assert.equal(state.sources.a.fitMode,'width');
 h.nodes().find(n=>n.type==='button'&&h.label(n)==='2. 원전 B').props.onClick();h.render();assert.equal(h.pdf('b').props.fitMode,'page');
 h.nodes().find(n=>n.type==='button'&&h.label(n)==='1. 원전 A').props.onClick();h.render();assert.equal(h.pdf('a').props.fitMode,'width');assert.equal(h.pdf('a').props.zoom,.96);
});
test('body mode retains a readable text scale while preserving the saved PDF fitting choice',async()=>{
 const h=harness({...saved,thesis:{page:249,zoom:.32,fitMode:'page'},manuscriptMode:'body'});await h.boot();assert.equal(h.body().props.zoom,.7);h.persist();
 const state=JSON.parse(h.values.get(readingSession.readingSessionKey('human-a')));assert.equal(state.thesis.zoom,.32);assert.equal(state.thesis.fitMode,'page');
 const zoom=h.nodes().find(n=>typeof n.type==='function'&&n.props.label==='본문 배율');assert.ok(zoom);assert.equal(zoom.props.onFit,undefined);zoom.props.onZoom(1.15);h.render();h.persist();
 assert.equal(h.body().props.zoom,1.15);assert.equal(JSON.parse(h.values.get(readingSession.readingSessionKey('human-a'))).thesis.fitMode,undefined);
});


test('ordinary entry presents both launch cards without changing the restored document or pane',async()=>{
 const state={...saved,metadataOpen:false,thesis:{page:249,zoom:.45,fitMode:'page'},sources:{...saved.sources,a:{page:199,zoom:1.3,fitMode:'width'}}};
 for(const width of [1701,390]){
  const h=harness(state,width,844,undefined,{search:'?v=265c'});await h.boot();h.persist();
  assert.ok(h.nodes().find(n=>n.type===WorkspaceLaunchers));
  const stored=JSON.parse(h.values.get(readingSession.readingSessionKey('human-a')));
  assert.deepEqual(stored,state);
  assert.equal(h.pdf('thesis').props.navigationToken,0);assert.equal(h.pdf('a').props.navigationToken,0);
 }
});

test('explicit FAQ opens its panel and glossary opens only its popup without moving the paper',async()=>{
 for(const view of ['faq','glossary']){
  const h=harness(saved,1701,900,undefined,{search:'?view='+view});await h.boot();h.applyDeepLink();h.render();h.persist();
  assert.equal(JSON.parse(h.values.get(readingSession.readingSessionKey('human-a'))).tab,view==='glossary'?'source':view);
  assert.deepEqual(h.popupCalls,view==='glossary'?['glossary']:[]);
  assert.equal(h.nodes().find(n=>n.type===WorkspaceLaunchers),undefined);
  assert.equal(h.pdf('thesis').props.page,249);assert.equal(h.pdf('a').props.page,199);
 }
});

test('collapsed menus hide start cards while preserving reading positions and hidden metadata',async()=>{
 const state={...saved,metadataOpen:false,readingView:{...readingView.DEFAULT_READING_VIEW,focus:true}};
 const h=harness(state,390,844,{...workspaceLayout.DEFAULT_WORKSPACE_LAYOUT,headerHeight:0});await h.boot();h.persist();
 assert.equal(h.nodes().find(n=>n.type===WorkspaceLaunchers),undefined);
 assert.deepEqual(JSON.parse(h.values.get(readingSession.readingSessionKey('human-a'))),state);
 assert.equal(h.pdf('thesis').props.page,249);assert.equal(h.pdf('a').props.page,199);
});
