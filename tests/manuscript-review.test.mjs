import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
// These reader tests isolate the new link layer while retaining its original text and note callback.
function LegalTextLeaf({text,onNote}){return React.createElement(React.Fragment,null,...text.split(/(\[\^\d+\])/g).map((part,i)=>onNote&&/^\[\^\d+\]$/.test(part)?React.createElement('button',{key:i,onClick:()=>onNote('fn-'+part.slice(2,-1).padStart(3,'0'))},part.slice(2,-1)+')'):part));}
function SourceTextLeaf({text}){return React.createElement(React.Fragment,null,text);}
function load(file){const source=readFileSync(new URL('../src/'+file,import.meta.url),'utf8');const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};vm.runInNewContext(output,{module,exports:module.exports,require:n=>n.endsWith('.css')?{}:n.endsWith('.json')?{}:n==='./legal-links'?{LegalText:LegalTextLeaf}:n==='./source-text'?{__esModule:true,default:SourceTextLeaf}:n==='./proposal-indicators'?load('proposal-indicators.ts'):n==='./reader-controls'?load('reader-controls.tsx'):n==='./body-reading-hook'?load('body-reading-hook.ts'):n==='./body-reading-position'?load('body-reading-position.ts'):require(n)});return module.exports;}
const {default:WebManuscript,InlineNoteText,manuscriptModeAfterRefresh,citationContextWasEdited,effectiveManuscriptEdits}=load('web-manuscript.tsx');
const {default:ProfileRow}=load('profile-row.tsx');
const catalog=JSON.parse(readFileSync(new URL('../src/paragraph-catalog.json',import.meta.url),'utf8'));
const guide=JSON.parse(readFileSync(new URL('../src/revision-proposals.json',import.meta.url),'utf8'));
// Public baseline fixture only; live server/catalog verification is separate.
const originals=JSON.parse(readFileSync(new URL('./fixtures/human-originals.json',import.meta.url),'utf8'));
const sha256=text=>createHash('sha256').update(text,'utf8').digest('hex');
const sample=[{id:'P0001',text:'제출자 김민규',page:1,printed:null,heading:true,kind:'paragraph',rects:[],order:1},{id:'P0283',text:'임차인 보호[^1]',page:20,printed:1,heading:false,kind:'paragraph',rects:[],order:283}];
test('shared edits select the current body for a new visitor, while explicit PDF and body choices survive polling',()=>{
 let mode=manuscriptModeAfterRefresh('pdf',false,0);
 assert.equal(mode,'pdf');
 mode=manuscriptModeAfterRefresh(mode,false,1);
 assert.equal(mode,'body');
 // A later or in-flight poll cannot undo the reader's explicit choice.
 mode='pdf';
 for(const count of [1,4,0,2]){mode=manuscriptModeAfterRefresh(mode,true,count);assert.equal(mode,'pdf');}
 assert.equal(manuscriptModeAfterRefresh('body',true,0),'body');
 // Restoring every edit does not unexpectedly switch the current reading view.
 assert.equal(manuscriptModeAfterRefresh('body',false,0),'body');
});
test('citation explanations are identified as original when the note or its original citing paragraph was revised',()=>{
 const paragraphs=[{id:'P0001',text:'본문[^1]'}, {id:'P0002',text:'다른 본문[^11]'}];
 assert.equal(citationContextWasEdited('fn-001',paragraphs,{}),false);
 assert.equal(citationContextWasEdited('fn-001',paragraphs,{'fn-001':{text:'각주 수정'}}),true);
 assert.equal(citationContextWasEdited('fn-001',paragraphs,{P0001:{text:'각주 표지가 삭제된 수정문'}}),true);
 assert.equal(citationContextWasEdited('fn-001',paragraphs,{P0002:{text:'다른 문단 수정'}}),false);
 assert.equal(citationContextWasEdited('fn-011',paragraphs,{P0002:{text:'다른 문단 수정'}}),true);
});
test('cover and original text remain visible; common edits replace text and are escaped',()=>{
 const html=renderToStaticMarkup(React.createElement(WebManuscript,{paragraphs:sample,overrides:{P0283:{text:'변경된 본문 <script>alert(1)</script>'},'fn-001':{text:'변경된 각주'}},notes:[{id:'fn-001',number:1,page:20,text:'원래 각주'}],page:20,zoom:1,selected:'P0283',onPageChange(){},onParagraph(){},onNote(){}}));
 assert.ok(html.includes('제출자 김민규'));assert.ok(html.includes('변경된 본문'));assert.ok(!html.includes('임차인 보호'));assert.ok(html.includes('변경된 각주'));assert.ok(!html.includes('원래 각주'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
});
test('revised document note numbers never link to unrelated original notes',()=>{
 const html=renderToStaticMarkup(React.createElement(InlineNoteText,{text:'원문[^32] 변경안〔각주 33〕',onNote(){}}));
 assert.equal((html.match(/<button/g)||[]).length,1);assert.ok(html.includes('32)'));assert.ok(html.includes('〔각주 33〕'));
});
test('deleted passages and footnotes disappear without inserting deletion instructions; restoring them is visible',()=>{
 const props={paragraphs:sample,notes:[{id:'fn-001',number:1,page:20,text:'원래 각주'}],page:20,zoom:1,selected:'',onPageChange(){},onParagraph(){},onNote(){}};
 const html=renderToStaticMarkup(React.createElement(WebManuscript,{...props,overrides:{P0283:{text:''},'fn-001':{text:''}}}));
 assert.match(html,/<div hidden="" data-paragraph="P0283"/);
 assert.match(html,/<div hidden="" class="manuscript-footnote-row"/);
 assert.doesNotMatch(html,/임차인 보호|원래 각주|\(삭제\)/);
 const restored=renderToStaticMarkup(React.createElement(WebManuscript,{...props,overrides:{P0283:{text:'임차인 보호[^1]'},'fn-001':{text:'원래 각주'}}}));
 assert.doesNotMatch(restored,/hidden=""/);assert.match(restored,/임차인 보호/);assert.match(restored,/원래 각주/);
});
test('web manuscript keeps its zoom factor at both desktop and mobile text sizes',()=>{
 const css=readFileSync(new URL('../src/web-manuscript.css',import.meta.url),'utf8');
 assert.match(css,/font-size:calc\(var\(--manuscript-base-size,18px\) \* var\(--manuscript-zoom,1\) \* var\(--review-font-scale,1.5\)\)/);
 assert.match(css,/@media\(max-width:700px\).*--manuscript-base-size:16px/);
 assert.doesNotMatch(css,/font-size:[^;}]*!important/);
 for(const zoom of [.7,1,1.6,2]){
  const html=renderToStaticMarkup(React.createElement(WebManuscript,{paragraphs:sample,overrides:{},notes:[],page:20,zoom,selected:'',onPageChange(){},onParagraph(){},onNote(){}}));
  assert.ok(html.includes(`--manuscript-zoom:${zoom}`));
 }
});

test('proposal labels retain urgency text and a deleted passage remains reviewable without reviving its content',()=>{
 const indicator={priority:'반드시 수정',tone:'required',shortLabel:'필수',proposalIds:['P0283'],primaryProposalId:'P0283'};
 const html=renderToStaticMarkup(React.createElement(WebManuscript,{paragraphs:sample,overrides:{P0283:{text:''}},proposalIndicators:{P0283:indicator},notes:[],page:20,zoom:1,selected:'',onPageChange(){},onParagraph(){},onNote(){},onProposal(){}}));
 assert.match(html,/수정제안 있음 · 반드시 수정/);assert.match(html,/proposal-required/);
 assert.match(html,/현재 본문에서 삭제된 문단/);assert.doesNotMatch(html,/<div hidden="" data-paragraph="P0283"/);
 assert.doesNotMatch(html,/임차인 보호/);
});
test('every editable paragraph preserves the independently recorded human original',()=>{
 assert.equal(catalog.pdfSha256,originals.pdfSha256);assert.equal(catalog.paragraphs.length,1046);
 assert.equal(Object.keys(originals.paragraphSha256).length,catalog.paragraphs.length);
 for(const p of catalog.paragraphs){assert.equal(sha256(p.text),originals.paragraphSha256[p.id],p.id);assert.ok(p.rects.length);assert.ok(p.rects.every(r=>r.page>=1&&r.page<=266&&r.rect[2]>r.rect[0]&&r.rect[3]>r.rect[1]));}
 for(const item of guide.items.filter(x=>/^P\d+$/.test(x.id)))assert.ok(Object.hasOwn(originals.paragraphSha256,item.id),item.id);
});
test('all 444 public footnotes retain their original text and a web manuscript page',()=>{
 const pages=new Set(catalog.paragraphs.flatMap(p=>p.rects.map(r=>r.page)));assert.equal(originals.footnotes.length,444);
 originals.footnotes.forEach((n,i)=>{assert.equal(n.id,'fn-'+String(i+1).padStart(3,'0'));assert.equal(n.number,i+1);assert.equal(sha256(n.text),n.textSha256);assert.ok(pages.has(n.page),n.id);});
 const noteIds=new Set(originals.footnotes.map(n=>n.id));
 for(const p of catalog.paragraphs)for(const match of p.text.matchAll(/\[\^(\d+)\]/g))assert.ok(noteIds.has('fn-'+match[1].padStart(3,'0')),p.id+' '+match[0]);
});
test('both editions retain their own appendix table pages',()=>{const release=JSON.parse(readFileSync(new URL('./fixtures/edition-release281.json',import.meta.url),'utf8'));for(const [ed,suffix] of [['human80',''],['v120','-v120'],['v121','-v121']]){const actual=JSON.parse(readFileSync(new URL('../src/paragraph-catalog'+suffix+'.json',import.meta.url),'utf8'));assert.equal(actual.paragraphs.find(p=>p.id===release[ed].lastParagraphId).page,release[ed].lastParagraphPage);}});
test('experience displays only the starting year for all recorded date forms',()=>{
 for(const period of ['2014. 8.~2017. 7.','2019. 10. 취임','2026. 4.부터','2026. 9.']){const html=renderToStaticMarkup(React.createElement(ProfileRow,{section:'experience',row:{period,institution:'기관',role:'위원'}}));assert.ok(html.includes('>'+period.slice(0,4)+'</span>'));assert.ok(!html.includes('취임'));assert.ok(!html.includes('부터'));assert.ok(!html.includes('~'));}
});
test('housing support manual appears once in books and patent is under research',()=>{
 const groups=JSON.parse(readFileSync(new URL('../src/research-achievements.json',import.meta.url),'utf8'));
 assert.equal(groups.flatMap(g=>g.items).filter(i=>i.title.includes('전세피해 법률지원 매뉴얼')).length,1);
 assert.ok(groups.find(g=>g.title==='저서').items.some(i=>i.title.includes('전세피해 법률지원 매뉴얼')));
 assert.ok(groups.find(g=>g.title==='저서').items.some(i=>i.title.includes('표준판례')));
 const s=readFileSync(new URL('../src/research-achievements.tsx',import.meta.url),'utf8');assert.ok(s.includes('10-2026-0191635'));
});

test('restored server heads retain optimistic revisions while only real text differences select the current body',()=>{
 const paragraphs=[{id:'P0283',text:'원문[^1]'}],notes=[{id:'fn-001',text:'각주 원문'}];
 const heads={P0283:{revision:2,text:'원문[^1]'},'fn-001':{revision:7,text:'각주 원문'}};
 const effective=effectiveManuscriptEdits(paragraphs,notes,heads);
 assert.equal(Object.keys(effective).length,0);
 assert.equal(manuscriptModeAfterRefresh('pdf',false,Object.keys(effective).length),'pdf');
 assert.equal(heads.P0283.revision,2);assert.equal(heads['fn-001'].revision,7);
 assert.equal(citationContextWasEdited('fn-001',paragraphs,effective),false);
 const changed={...heads,P0283:{revision:3,text:'실제 수정'}};
 const changes=effectiveManuscriptEdits(paragraphs,notes,changed);
 assert.equal(Object.keys(changes).length,1);assert.equal(changes.P0283,changed.P0283);
 assert.equal(manuscriptModeAfterRefresh('pdf',false,Object.keys(changes).length),'body');
 assert.equal(manuscriptModeAfterRefresh('pdf',true,Object.keys(changes).length),'pdf');
});
test('empty deletions and exact whitespace changes remain real changes; unknown originals are never silently omitted',()=>{
 const paragraphs=[{id:'P0283',text:'원문'}],notes=[{id:'fn-001',text:'각주 원문'}];
 for(const text of ['',' ','원문 ']){
  const heads={P0283:{text,revision:3}};
  assert.equal(effectiveManuscriptEdits(paragraphs,notes,heads).P0283,heads.P0283);
 }
 const deletion=effectiveManuscriptEdits(paragraphs,notes,{'fn-001':{text:'',revision:8}});
 assert.equal(deletion['fn-001'].text,'');
 assert.equal(effectiveManuscriptEdits(paragraphs,[],{'fn-001':{text:'미확인'}})['fn-001'].text,'미확인');
});
test('workspace waits for original notes before automatic view selection and passes all heads to editors',()=>{
 const source=readFileSync(new URL('../src/review-workspace.tsx',import.meta.url),'utf8');
 assert.match(source,/if\(data\)setManuscriptMode\(current=>manuscriptModeAfterRefresh\(current,manuscriptViewChosen.current,Object.keys\(effectiveShared\).length\)\)/);
 assert.doesNotMatch(source,/manuscriptModeAfterRefresh\([^;]*result.overrides.length/);
 assert.match(source,/overrides=\{effectiveShared\}/);
 assert.match(source,/current=\{shared\[paragraph.id\]\}/);assert.match(source,/current=\{shared\[active\]\}/);
});
