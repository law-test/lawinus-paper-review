import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as tools from '../src/workspace-tools.ts';
const require=createRequire(import.meta.url);
const code=ts.transpileModule(readFileSync(new URL('../src/workspace-tool-popups.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
function walk(root){const nodes=[];function visit(node){if(!node||typeof node!=='object')return;nodes.push(node);React.Children.forEach(node.props?.children,visit);}visit(root);return nodes;}
function harness({width=1700,blocked=false,search='?view=faq',paused=false,embedded=false}={}){
 const state=[],refs=[],calls=[],windows=[];let cursor=0,refCursor=0,effects=[];
 class Element{isConnected=true;focusCalls=[];focus(options){this.focusCalls.push(options);}}
 const trigger=new Element(),document={activeElement:trigger};
 const values=new Map(paused?[[tools.GLOSSARY_AUTOSTART_PAUSE_KEY,String(Date.now()+tools.GLOSSARY_PAUSE_MS)]]:[]),listeners=new Map();
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const browser={innerWidth:width,location:{href:'https://paper.lawinus.org/'+search,search,hash:''},localStorage:storage,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),open(...args){calls.push(args);if(blocked)return null;const tool={closed:false,focusCalls:0,focus(){this.focusCalls++;}};windows.push(tool);return tool;}};
 browser.self=browser;browser.top=embedded?{}:browser;
 const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,document,window:browser,HTMLElement:Element,require:id=>{
  if(id==='react')return {...React,useState:initial=>{const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next;}];},useRef:initial=>refs[refCursor++]??=({current:initial}),useEffect:fn=>effects.push(fn)};
  if(id==='./workspace-tools')return {...tools,glossaryPopupStorage:()=>storage,openWorkspaceTool:tool=>tools.openWorkspaceTool(tool,browser)};
  if(id==='./glossary-auto-open-control')return {default:()=>null};
  if(id.endsWith('.css'))return {};return require(id);
 }});
 return {calls,windows,trigger,browser,refs,Element,listeners,storage,render(){cursor=0;refCursor=0;effects=[];return module.exports.useWorkspaceToolPopups();},effects:()=>effects};
}
test('explicit entry leaves the paper unmodified and opens no window automatically',()=>{
 for(const search of ['?view=faq', '?view=glossary', '?paragraph=P0283', '?view=glossary&dictionary=1&embedded=1']){
  const h=harness({search}),before=h.browser.location.href,result=h.render();h.effects().forEach(fn=>fn());
  assert.equal(result.layer,null);assert.equal(h.calls.length,0);assert.equal(h.browser.location.href,before);
 }
});
test('click handler opens the native window synchronously and repeated clicks focus the same context',()=>{
 const h=harness(),result=h.render(),before=h.browser.location.href;result.openTool('glossary');
 assert.equal(h.calls.length,1,'window.open happens before any effect or next render');assert.equal(h.render().layer,null);
 assert.equal(h.calls[0][1],'lawinus-glossary');assert.match(h.calls[0][2],/popup.*resizable=yes.*scrollbars=yes/);
 result.openTool('glossary');assert.equal(h.calls.length,1);assert.equal(h.windows[0].focusCalls,2);assert.equal(h.browser.location.href,before);
});
test('blocked opening exposes an ordinary noopener new-tab link instead of an embedded fallback',()=>{
 const h=harness({blocked:true});h.render().openTool('glossary');const result=h.render(),nodes=walk(result.layer),link=nodes.find(n=>n.type==='a');
 assert.equal(h.calls.length,1);assert.equal(nodes.filter(n=>n.type==='iframe').length,0);
 assert.equal(link.props.href,'./?view=glossary&dictionary=1');assert.equal(link.props.target,'_blank');assert.equal(link.props.rel,'noopener noreferrer');
 const focused=new h.Element();link.props.ref.current=focused;h.effects().forEach(fn=>fn());assert.equal(focused.focusCalls[0].preventScroll,true);
 link.props.onClick();assert.equal(h.calls.length,1,'fallback relies on the browser anchor, not a second popup attempt');assert.equal(h.render().layer,null);
});
test('deep-link requests present a manual link without pretending the browser blocked a popup',()=>{
 const h=harness({search:'?view=glossary'});h.render().openTool('glossary',false);const layer=h.render().layer,nodes=walk(layer);
 assert.equal(h.calls.length,0);assert.ok(nodes.some(n=>n.type==='a'));
 assert.ok(nodes.filter(n=>n.type==='p').every(n=>!String(n.props.children).includes('차단')));
});
test('paused AI cannot open a native context or even a fallback link',()=>{
 const h=harness({blocked:true});h.render().openTool('ai-mingyu');assert.equal(h.calls.length,0);assert.equal(h.render().layer,null);
 h.render().openTool('ai-mingyu',false);assert.equal(h.render().layer,null);
});
test('small screens request a reusable browser tab and never replace the original paper',()=>{
 const h=harness({width:390}),before=h.browser.location.href;h.render().openTool('glossary');
 assert.equal(h.calls[0].length,2);assert.equal(h.calls[0][1],'lawinus-glossary');assert.equal(h.browser.location.href,before);assert.equal(h.render().layer,null);
});
test('fallback Escape or close restores its initiating control without scrolling',()=>{
 for(const method of ['escape','button']){
  const h=harness({blocked:true});h.render().openTool('glossary');const layer=h.render().layer;
  if(method==='escape'){let prevented=false;layer.props.onKeyDown({key:'Escape',preventDefault(){prevented=true;}});assert.equal(prevented,true);}
  else walk(layer).find(n=>n.type==='button'&&n.props['aria-label']==='새 창 안내 닫기').props.onClick();
  assert.equal(h.render().layer,null);assert.equal(h.trigger.focusCalls[0].preventScroll,true);
 }
});

test('ordinary entry attempts a real glossary window once and offers week pause even when opening succeeds',()=>{
 for(const search of ['', '?v=272']){
  const h=harness({search}),before=h.browser.location.href;h.render();h.effects().forEach(fn=>fn());const result=h.render();
  assert.equal(h.calls.length,1);assert.equal(h.calls[0][1],'lawinus-glossary');assert.ok(walk(result.layer).some(n=>n.props.onPaused));assert.equal(h.browser.location.href,before);
  h.effects().forEach(fn=>fn());assert.equal(h.calls.length,1,'effect replay must not duplicate automatic windows');
 }
});
test('blocked automatic popup offers a manual click and pause without focus stealing or repeated attempts',()=>{
 const h=harness({search:'',blocked:true});h.render();h.effects().forEach(fn=>fn());let result=h.render();
 const link=walk(result.layer).find(n=>n.type==='a'),focused=new h.Element();link.props.ref.current=focused;h.effects().forEach(fn=>fn());
 assert.equal(focused.focusCalls.length,0);assert.equal(h.calls.length,1);
 h.browser.open=(...args)=>{h.calls.push(args);return {focus(){}};};
 walk(result.layer).find(n=>n.type==='button'&&!n.props['aria-label']).props.onClick();assert.equal(h.calls.length,2);assert.equal(h.render().layer,null);
});
test('a week pause or embedded frame prevents automatic launch but does not prevent manual opening',()=>{
 for(const options of [{paused:true},{embedded:true}]){
  const h=harness({search:'',...options});h.render();h.effects().forEach(fn=>fn());assert.equal(h.calls.length,0);assert.equal(h.render().layer,null);
  h.render().openTool('glossary');assert.equal(h.calls.length,1);
 }
});
test('pausing from the separate glossary window dismisses the parent automatic notice',()=>{
 const h=harness({search:''});h.render();h.effects().forEach(fn=>fn());assert.ok(h.render().layer);
 tools.pauseGlossaryForWeek(h.storage);h.listeners.get('storage')({type:'storage',key:tools.GLOSSARY_AUTOSTART_PAUSE_KEY});assert.equal(h.render().layer,null);
});
