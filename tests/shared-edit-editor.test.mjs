import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../src/shared-edit-editor.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};
vm.runInNewContext(compiled,{module,exports:module.exports,require:id=>{
 if(id.endsWith('.css'))return {};
 if(id==='./shared-edits')return {};
 return require(id);
}});
const {initialSharedEditorState:init,sharedEditorReducer:reduce,readSharedEditorDraft:readDraft,writeSharedEditorDraft:writeDraft,sharedDraftKey,SharedEditEditor}=module.exports;
const edit=(revision,text)=>({id:String(revision),kind:'paragraph',targetId:'P0001',revision,text});
function memoryStorage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}

test('an intentionally emptied saved paragraph is not silently replaced by its original',()=>{
 const state=init('원문',edit(3,''));
 assert.equal(state.draft,'');assert.equal(state.baseText,'');assert.equal(state.revision,3);
});

test('a conflicting edit preserves the complete draft, reason and old expected revision',()=>{
 let state=init('원문',edit(1,'첫 수정'));
 state=reduce(state,{type:'draft',value:'내 초안\n두 번째 문단'});
 state=reduce(state,{type:'reason',value:'정확한 인용을 위한 수정'});
 state=reduce(state,{type:'conflict'});
 assert.equal(state.draft,'내 초안\n두 번째 문단');assert.equal(state.reason,'정확한 인용을 위한 수정');
 assert.equal(state.revision,1);assert.equal(state.conflict,true);
});

test('reviewing a newer version preserves the draft and requires confirmation before overwriting it',()=>{
 let state=reduce(init('원문',edit(1,'첫 수정')),{type:'draft',value:'내 문안'});
 state=reduce(state,{type:'incoming',revision:2,text:'다른 방문자의 문안'});
 assert.equal(state.revision,1);assert.equal(state.draft,'내 문안');assert.equal(state.conflict,true);
 state=reduce(state,{type:'latest',revision:2,text:'다른 방문자의 문안'});
 assert.equal(state.revision,2);assert.equal(state.baseText,'다른 방문자의 문안');
 assert.equal(state.draft,'내 문안');assert.equal(state.conflict,false);assert.equal(state.confirmOverwrite,true);
 state=reduce(state,{type:'saved',edit:edit(3,'내 문안')});
 assert.equal(state.revision,3);assert.equal(state.baseText,state.draft);assert.equal(state.confirmOverwrite,false);
});

test('clean drafts follow external updates while late responses cannot roll back an accepted revision',()=>{
 let state=init('원문');
 state=reduce(state,{type:'incoming',revision:4,text:'새 본문'});
 assert.equal(state.draft,'새 본문');assert.equal(state.revision,4);assert.equal(state.conflict,false);
 assert.equal(reduce(state,{type:'latest',revision:2,text:'오래된 본문'}),state);
 assert.equal(reduce(state,{type:'incoming',revision:3,text:'오래된 본문'}),state);
});

test('restoration accepts the server-created new revision rather than resetting to the old number',()=>{
 let state=init('원문',edit(7,'현재'));
 state=reduce(state,{type:'saved',edit:{...edit(8,'원문'),action:'restore',restoredFromRevision:0}});
 assert.equal(state.revision,8);assert.equal(state.draft,'원문');assert.equal(state.baseText,'원문');
 assert.equal(state.reason,'');assert.equal(state.conflict,false);
});

test('the initial accessible editor preserves deleted text and offers an empty safe deletion proposal',()=>{
 const html=renderToStaticMarkup(React.createElement(SharedEditEditor,{
  kind:'paragraph',targetId:'P0001',originalText:'되살아나면 안 되는 원문',proposalApplyText:'',current:edit(3,''),onSaved:()=>{},
 }));
 assert.match(html,/수정할 문안/);assert.match(html,/Before 넣기/);assert.match(html,/삭제안 넣기/);
 assert.match(html,/본문 수정하기/);assert.match(html,/변경 이력 보기/);
 assert.doesNotMatch(html,/되살아나면 안 되는 원문/);
 assert.match(html,/<textarea[^>]+class="shared-edit-body"[^>]*><\/textarea>/);
});

test('unsupported layout or compound changes cannot inject displayed After instructions',()=>{
 const html=renderToStaticMarkup(React.createElement(SharedEditEditor,{
  kind:'paragraph',targetId:'P0001',originalText:'원래 본문',proposalUnsupportedReason:'여러 문단과 각주를 함께 편집해야 합니다.',current:undefined,onSaved:()=>{},
 }));
 assert.match(html,/여러 문단과 각주를 함께 편집해야 합니다/);
 assert.doesNotMatch(html,/After 넣기|삭제안 넣기/);
 assert.match(html,/>원래 본문<\/textarea>/);
 const safe=renderToStaticMarkup(React.createElement(SharedEditEditor,{
  kind:'footnote',targetId:'fn-001',originalText:'원래 각주',proposalApplyText:'수정된 각주',current:undefined,onSaved:()=>{},
 }));
 assert.match(safe,/After 넣기/);
 assert.match(safe,/>원래 각주<\/textarea>/);
});

test('switching paragraphs and footnotes preserves separate drafts and their conflict baselines',()=>{
 const store=memoryStorage();
 let paragraph=reduce(init('본문 원문',edit(4,'저장된 본문')),{type:'draft',value:'본문 초안'});
 paragraph=reduce(paragraph,{type:'reason',value:'본문 수정 이유'});
 const footnote=reduce(init('각주 원문'),{type:'draft',value:'각주 초안'});
 writeDraft(store,'paragraph','P0001','본문 원문',paragraph);writeDraft(store,'footnote','fn-001','각주 원문',footnote);
 const restored=readDraft(store,'paragraph','P0001','본문 원문',edit(5,'다른 방문자 수정'));
 assert.equal(restored.recovered,true);assert.equal(restored.state.draft,'본문 초안');assert.equal(restored.state.reason,'본문 수정 이유');
 assert.equal(restored.state.revision,4);assert.equal(restored.state.baseText,'저장된 본문');
 const conflicted=reduce(restored.state,{type:'incoming',revision:5,text:'다른 방문자 수정'});
 assert.equal(conflicted.conflict,true);assert.equal(conflicted.draft,'본문 초안');
 assert.equal(readDraft(store,'footnote','fn-001','각주 원문').state.draft,'각주 초안');
});

test('saving or restoring clears only that target draft, while a changed original is not given an old draft',()=>{
 const store=memoryStorage();let a=reduce(init('원문'),{type:'draft',value:'초안'});
 writeDraft(store,'paragraph','P0001','원문',a);writeDraft(store,'paragraph','P0002','별도 원문',a);
 const changed=readDraft(store,'paragraph','P0001','새 기준본');assert.equal(changed.recovered,false);assert.equal(changed.state.draft,'새 기준본');
 a=reduce(a,{type:'saved',edit:edit(1,'초안')});writeDraft(store,'paragraph','P0001','원문',a);
 assert.equal(store.getItem(sharedDraftKey('paragraph','P0001')),null);
 assert.notEqual(store.getItem(sharedDraftKey('paragraph','P0002')),null);
});

test('storage failures and malformed drafts leave the authoritative initial text available',()=>{
 const bad={getItem(){throw new Error('blocked');}};
 assert.equal(readDraft(bad,'paragraph','P0001','원문').failed,true);
 const store=memoryStorage();store.setItem(sharedDraftKey('paragraph','P0001'),'{bad json');
 const result=readDraft(store,'paragraph','P0001','원문');assert.equal(result.state.draft,'원문');assert.equal(result.recovered,false);
});
