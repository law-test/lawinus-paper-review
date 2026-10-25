import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../src/memo-dialog.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
function load(env={}){
 const refs=[],effects=[],module={exports:{}};
 const drag=env.drag??{offset:{x:0,y:0},dragging:false,handleProps:{tabIndex:0,onPointerDown(){},onPointerMove(){},onKeyDown(){}}};let dragOptions;
 vm.runInNewContext(compiled,{module,exports:module.exports,require:id=>id==='react'?{...React,useRef:value=>{const ref={current:value};refs.push(ref);return ref;},useEffect:fn=>effects.push(fn)}:id==='./use-popup-drag'?{usePopupDrag:options=>{dragOptions=options;return drag;}}:id.endsWith('.css')?{}:require(id),...env});
 return {...module.exports,refs,effects,drag,get dragOptions(){return dragOptions;}};
}
const draft={anchorType:'source',sourceId:'source-1',noteId:'fn-001',page:27,text:'확인할 문장\n다음 문장',quote:'인용문',visibility:'private',status:'open'};
function render(extra={},env){
 const calls=[],m=load(env),props={draft:{...draft},saving:false,sessionReady:true,sessionConnecting:false,error:'',onChange:v=>calls.push(['change',v]),onClose:()=>calls.push(['close']),onSave:()=>calls.push(['save']),onDelete:()=>calls.push(['delete']),onReconnect:()=>calls.push(['reconnect']),...extra};
 const tree=m.default(props),nodes=[];function walk(node){if(!node||typeof node!=='object')return;nodes.push(node);React.Children.forEach(node.props?.children,walk);}walk(tree);
 return {m,tree,nodes,calls,html:renderToStaticMarkup(tree)};
}
test('memo input and save actions have separate scroll and fixed-action containers',()=>{
 const r=render(),body=r.nodes.find(n=>n.props.className==='memo-dialog-body'),actions=r.nodes.find(n=>n.props.className==='modal-actions');
 assert.ok(body);assert.ok(actions);assert.ok(!React.Children.toArray(body.props.children).includes(actions));
 assert.match(r.html,/role="dialog" aria-modal="true"/);assert.match(r.html,/PDF 27쪽/);
 const css=readFileSync(new URL('../src/memo-dialog.css',import.meta.url),'utf8');
 assert.match(css,/\.memo-modal\.memo-dialog\{[^}]*flex-direction:column[^}]*overflow:hidden/);
 assert.match(css,/\.memo-dialog-body\{[^}]*min-height:0[^}]*overflow:auto/);
 assert.match(css,/\.memo-dialog \.modal-actions\{[^}]*flex:0 0 auto[^}]*position:static/);
 assert.match(css,/var\(--visible-height,100dvh\) - 16px/);
});
test('editing preserves the selected source, location, quote, ownership and revision',()=>{
 const r=render({draft:{...draft,id:'memo-1',revision:8,editable:true}}),input=r.nodes.find(n=>n.type==='textarea');
 input.props.onChange({target:{value:'수정한 메모'}});
 assert.deepEqual(JSON.parse(JSON.stringify(r.calls)),[['change',{...draft,id:'memo-1',revision:8,editable:true,text:'수정한 메모'}]]);
 assert.equal(input.props.maxLength,10000);
 r.nodes.find(n=>n.type==='button'&&n.props.className==='primary').props.onClick();assert.equal(r.calls.at(-1)[0],'save');
});
test('failed save retains input and presents the error with a usable retry button',()=>{
 const r=render({error:'연결이 끊겼습니다. 다시 저장해 주세요.'}),input=r.nodes.find(n=>n.type==='textarea'),save=r.nodes.find(n=>n.type==='button'&&n.props.className==='primary');
 assert.equal(input.props.value,draft.text);assert.match(r.html,/role="alert"/);assert.equal(save.props.disabled,false);assert.deepEqual(r.calls,[]);
});
test('pending save prevents backdrop dismissal and disables editing without clearing the draft',()=>{
 const r=render({saving:true});const target={};r.tree.props.onClick({target,currentTarget:target});
 assert.deepEqual(r.calls,[]);assert.equal(r.nodes.find(n=>n.type==='textarea').props.value,draft.text);
 assert.ok(r.nodes.filter(n=>n.type==='button').every(n=>n.props.disabled));
 assert.ok(r.nodes.filter(n=>n.type==='input').every(n=>n.props.disabled));
});
test('unowned memo remains read-only and disconnected session cannot save',()=>{
 const r=render({draft:{...draft,id:'shared-other',editable:false}});
 assert.equal(r.nodes.find(n=>n.type==='textarea').props.readOnly,true);
 assert.ok(!r.nodes.some(n=>n.type==='button'&&(n.props.className==='primary'||n.props.className==='danger')));
 const disconnected=render({sessionReady:false});assert.equal(disconnected.nodes.find(n=>n.props.className==='primary').props.disabled,true);
 assert.match(disconnected.html,/다시 연결/);
});
test('keyboard reduction scrolls only the memo body and keeps the input start reachable',()=>{
 const {memoInputScrollTop:next}=load();
 assert.equal(next(0,100,150,240,140),130);
 assert.equal(next(0,100,80,240,140),140);
 assert.equal(next(140,100,80,100,140),140);
 assert.equal(next(140,100,300,100,140),140);
 assert.equal(next(140,100,80,80,140),120);
 assert.equal(next(140,100,0,80,140),140);
});
test('mount and keyboard resize preserve document scroll and return focus without scrolling',()=>{
 const listeners=new Map(),viewListeners=new Map(),restored=[],focused=[];
 const opener={isConnected:true,focus:options=>restored.push(options)};
 const document={activeElement:opener,addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k)};
 const window={visualViewport:{addEventListener:(k,f)=>viewListeners.set(k,f),removeEventListener:k=>viewListeners.delete(k)},addEventListener(){},removeEventListener(){}};
 const r=render({}, {document,window,requestAnimationFrame:f=>{f();return 1;},cancelAnimationFrame(){}});
 const body={scrollTop:0,clientHeight:150,getBoundingClientRect:()=>({top:100})};
 const input={focus:options=>{focused.push(options);document.activeElement=input;},getBoundingClientRect:()=>({top:240-body.scrollTop,height:140})};
 r.m.refs[0].current={querySelectorAll:()=>[]};r.m.refs[1].current=body;r.m.refs[2].current=input;
 const cleanup=r.m.effects[0]();assert.equal(focused[0].preventScroll,true);assert.equal(body.scrollTop,130);
 body.clientHeight=80;viewListeners.get('resize')();assert.equal(body.scrollTop,140);
 cleanup();assert.equal(restored[0].preventScroll,true);assert.equal(listeners.size,0);assert.equal(viewListeners.size,0);
});

async function saveWithMock(options={}){
 const workspace=readFileSync(new URL('../src/review-workspace.tsx',import.meta.url),'utf8');
 const fn=workspace.slice(workspace.indexOf('async function saveMemo()'),workspace.indexOf('async function removeMemo('));
 const code=ts.transpileModule(fn+'\nglobalThis.runSave=saveMemo;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const calls=[],context={saving:false,composer:{...draft,...options.draft},sessionReady:options.ready!==false,setSaving:value=>{context.saving=value;},setComposerError:value=>calls.push(['error',value]),setComposer:value=>calls.push(['composer',value]),api:async(path,request)=>{calls.push(['request',path,JSON.parse(request.body)]);if(options.failure)throw Error('시험 연결 실패');return {};},refreshMemos:async()=>calls.push(['refresh'])};
 vm.runInNewContext(code,context);await context.runSave();return {context,calls};
}
test('new memo save submits the original location and private status before closing and refreshing',async()=>{
 const {calls,context}=await saveWithMock();
 const request=calls.find(c=>c[0]==='request');assert.equal(request[1],'/api/notes');assert.deepEqual(request[2],draft);
 assert.ok(calls.findIndex(c=>c[0]==='composer'&&c[1]===null)>calls.indexOf(request));assert.equal(calls.at(-1)[0],'refresh');assert.equal(context.saving,false);
});
test('failed save preserves the draft and revision for retry without closing or refreshing',async()=>{
 const {calls,context}=await saveWithMock({failure:true,draft:{id:'memo-8',revision:4,editable:true}});
 const request=calls.find(c=>c[0]==='request');assert.equal(request[1],'/api/notes/memo-8');assert.equal(request[2].revision,4);
 assert.ok(!calls.some(c=>c[0]==='composer'||c[0]==='refresh'));assert.equal(context.composer.text,draft.text);assert.equal(context.composer.revision,4);assert.equal(context.saving,false);
 assert.ok(calls.some(c=>c[0]==='error'&&c[1]==='시험 연결 실패'));
});
test('disconnected or empty memo never calls a save endpoint',async()=>{
 for(const options of [{ready:false},{draft:{text:'  '}}]){const {calls}=await saveWithMock(options);assert.ok(!calls.some(c=>c[0]==='request'||c[0]==='composer'));}
});

test('memo title binds the shared drag handle while its body and save actions remain independent',()=>{
 const drag={offset:{x:90,y:65},dragging:true,handleProps:{tabIndex:0,onPointerDown(){},onPointerMove(){},onKeyDown(){}}};
 const r=render({}, {drag}),section=r.nodes.find(n=>n.type==='section'),heading=r.nodes.find(n=>n.props.className==='modal-heading'),body=r.nodes.find(n=>n.props.className==='memo-dialog-body');
 assert.equal(r.m.dragOptions.elementRef,section.props.ref);assert.equal(r.m.dragOptions.boundary,'header');assert.equal(section.props.style.transform,'translate(90px,65px)');assert.equal(section.props['data-dragging'],true);
 assert.equal(heading.props.onPointerDown,drag.handleProps.onPointerDown);assert.equal(heading.props.onKeyDown,drag.handleProps.onKeyDown);assert.equal(heading.props.tabIndex,0);assert.match(heading.props['aria-keyshortcuts'],/Home/);
 assert.equal(body.props.onPointerDown,undefined);assert.equal(body.props.onPointerMove,undefined);assert.equal(r.nodes.find(n=>n.type==='textarea').props.value,draft.text);
 const css=readFileSync(new URL('../src/memo-dialog.css',import.meta.url),'utf8');assert.match(css,/\.memo-dialog \.modal-heading\{[^}]*touch-action:none/);assert.doesNotMatch(css,/\.memo-dialog-body\{[^}]*touch-action:none/);
});

test('Tab includes the movable title in the focus loop and Escape retains the save guard',()=>{
 const listeners=new Map(),focused=[];
 const document={activeElement:null,addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)};
 const window={addEventListener(){},removeEventListener(){}};
 const r=render({}, {document,window,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
 const title={focus:()=>{focused.push('title');document.activeElement=title;}},save={focus:()=>{focused.push('save');document.activeElement=save;}};
 let selector='';r.m.refs[0].current={querySelectorAll:value=>{selector=value;return [title,save];}};
 const cleanup=r.m.effects[0]();let prevented=0;
 document.activeElement=save;listeners.get('keydown')({key:'Tab',shiftKey:false,preventDefault(){prevented++;}});assert.equal(focused.at(-1),'title');assert.match(selector,/\[tabindex="0"\]/);
 listeners.get('keydown')({key:'Tab',shiftKey:true,preventDefault(){prevented++;}});assert.equal(focused.at(-1),'save');assert.equal(prevented,2);
 listeners.get('keydown')({key:'Escape',preventDefault(){}});assert.deepEqual(r.calls,[['close']]);cleanup();
 const pending=render({saving:true},{document,window,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});const end=pending.m.effects[0]();listeners.get('keydown')({key:'Escape',preventDefault(){}});assert.deepEqual(pending.calls,[]);end();
});
