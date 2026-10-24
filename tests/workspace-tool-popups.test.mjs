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
function harness({width=1700,search='',embedded=false,seen=false}={}){
 const values=new Map([['reading-position','6543']]);if(seen)values.set(tools.WORKSPACE_POPUPS_SEEN_KEY,'1');
 const store={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 const state=[],refs=[];let cursor=0,refCursor=0,effects=[],nativeOpens=0;
 class Element{isConnected=true;focusCalls=0;closest(){return null;}focus(){this.focusCalls++;}}
 const trigger=new Element(),document={activeElement:trigger,body:new Element(),querySelector:()=>trigger,getElementById:()=>trigger};
 const window={innerWidth:width,location:{search,hash:''},localStorage:store,sessionStorage:store,addEventListener(){},removeEventListener(){},open(){nativeOpens++;}};window.self=window;window.top=embedded?{}:window;
 const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,window,document,HTMLElement:Element,queueMicrotask:fn=>fn(),require:id=>{
  if(id==='react')return {...React,useState:initial=>{const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next;}];},useRef:initial=>refs[refCursor++]??=({current:initial}),useEffect:fn=>effects.push(fn)};
  if(id==='./workspace-tools')return tools;if(id.endsWith('.css'))return {};return require(id);
 }});
 return {values,trigger,document,window,get nativeOpens(){return nativeOpens;},render(name,props){cursor=0;refCursor=0;effects=[];return module.exports[name](props);},effects:()=>effects};
}
test('first visit opens both tools once without native popup attempts or reading-position writes',()=>{
 const h=harness();let result=h.render('useWorkspaceToolPopups');assert.deepEqual([...result.layer.props.open],['ai-mingyu','glossary']);h.effects().forEach(fn=>fn());
 assert.equal(h.values.get(tools.WORKSPACE_POPUPS_SEEN_KEY),'1');assert.equal(h.nativeOpens,0);assert.equal(h.values.get('reading-position'),'6543');
 result.layer.props.onClose('ai-mingyu');result=h.render('useWorkspaceToolPopups');assert.deepEqual([...result.layer.props.open],['glossary']);
 result.layer.props.onClose('glossary');result=h.render('useWorkspaceToolPopups');assert.deepEqual([...result.layer.props.open],[]);
 result.openTool('glossary');result=h.render('useWorkspaceToolPopups');assert.deepEqual([...result.layer.props.open],['glossary']);result.layer.props.onClose('glossary');assert.ok(h.trigger.focusCalls>0);
 assert.equal(h.values.get('reading-position'),'6543');assert.equal(h.nativeOpens,0);
 for(const options of [{seen:true},{search:'?proposal=P0384'},{search:'?view=glossary&dictionary=1&embedded=1',embedded:true}])assert.deepEqual([...harness(options).render('useWorkspaceToolPopups').layer.props.open],[]);
});
test('desktop exposes two nonmodal dialogs; compact view keeps both frames but shows one tab panel',()=>{
 for(const width of [1700,390]){
  const h=harness({width}),opened=[];const tree=h.render('WorkspaceToolPopups',{open:['ai-mingyu','glossary'],active:'ai-mingyu',focusSerial:0,onOpen:tool=>opened.push(tool),onClose(){},onActive(){}}),nodes=walk(tree);
  const panels=nodes.filter(n=>n.type==='section'),frames=nodes.filter(n=>n.type==='iframe');assert.equal(frames.length,2);assert.equal(panels.length,2);
  assert.deepEqual(frames.map(n=>n.props.src),['./?view=ai-mingyu&chat=1&embedded=1','./?view=glossary&dictionary=1&embedded=1']);assert.equal(h.nativeOpens,0);
  if(width===1700){assert.ok(panels.every(n=>n.props.role==='dialog'&&n.props['aria-modal']===false&&!n.props.hidden));}
  else{assert.deepEqual(panels.map(n=>n.props.hidden),[false,true]);const tabs=nodes.filter(n=>n.props?.role==='tab');assert.equal(tabs.length,2);tabs[0].props.onKeyDown({key:'ArrowRight',preventDefault(){}});assert.deepEqual(opened,['glossary']);assert.ok(h.trigger.focusCalls>0);}
  assert.ok(nodes.filter(n=>n.type==='a').every(n=>n.props.target==='_blank'&&n.props.rel==='noopener noreferrer'));
 }
});
test('iframe Escape closes its tool and stops speech while preserving nested modal Escape',()=>{
 const h=harness(),closed=[],listeners=new Map();let nested=false,cancels=0,prevented=0;
 const tree=h.render('WorkspaceToolPopups',{open:['ai-mingyu','glossary'],active:'ai-mingyu',focusSerial:0,onOpen(){},onClose:tool=>closed.push(tool),onActive(){}});
 const frame=walk(tree).find(n=>n.type==='iframe');const inner={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name)=>listeners.delete(name),querySelector:()=>nested?{}:null};
 frame.props.onLoad({currentTarget:{contentDocument:inner,contentWindow:{speechSynthesis:{cancel(){cancels++;}}}}});
 const event=()=>({key:'Escape',defaultPrevented:false,isComposing:false,preventDefault(){prevented++;}});
 nested=true;listeners.get('keydown')(event());assert.equal(closed.length,0);nested=false;
 listeners.get('keydown')({...event(),defaultPrevented:true});listeners.get('keydown')({...event(),isComposing:true});assert.equal(closed.length,0);
 listeners.get('keydown')(event());assert.deepEqual(closed,['ai-mingyu']);assert.equal(cancels,1);assert.equal(prevented,1);
});
test('each header has an accessible close action and desktop Escape uses the same action',()=>{
 const h=harness(),closed=[];const tree=h.render('WorkspaceToolPopups',{open:['glossary'],active:'glossary',focusSerial:1,onOpen(){},onClose:tool=>closed.push(tool),onActive(){}}),nodes=walk(tree);
 const button=nodes.find(n=>n.type==='button'&&n.props['data-popup-close']);assert.match(button.props['aria-label'],/사전.*닫기/);button.props.onClick();
 const panel=nodes.find(n=>n.type==='section');panel.props.onKeyDown({key:'Escape',defaultPrevented:false,nativeEvent:{isComposing:false},preventDefault(){}});assert.deepEqual(closed,['glossary','glossary']);
});
test('popup stacking leaves view menus and existing modal dialogs above tools',()=>{
 const css=readFileSync(new URL('../src/workspace-tool-popups.css',import.meta.url),'utf8');assert.match(css,/z-index:90/);assert.match(css,/--reading-actions-height/);assert.match(css,/\.workspace-tool-popup\[hidden\]/);
});
