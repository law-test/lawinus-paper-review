import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const guide=read('../src/revision-proposals.json'),original=read('./fixtures/human-originals.json');
const paragraphs=new Map(read('../src/paragraph-catalog.json').paragraphs.map(p=>[p.id,p]));
const applied=new Map(read('../src/paragraph-catalog-v110.json').paragraphs.map(p=>[p.id,p]));
const notes=new Map(original.footnotes.map(n=>[n.id,n]));
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
test('v110 keeps 164 human73 instructions with separate original and applied navigation',()=>{
 assert.equal(guide.version,'v110');assert.equal(guide.baseline,'human-1026-1710');assert.equal(guide.items.length,164);
 assert.equal(new Set(guide.items.map(p=>p.id)).size,164);
 for(const p of guide.items){
  assert.ok(p.humanPages.length&&p.humanPages.every(n=>n>=1&&n<=324),p.id);
  assert.ok(p.appliedPages.length&&p.appliedPages.every(n=>n>=1&&n<=335),p.id);
  assert.equal(p.page,p.humanPage,p.id);assert.equal(typeof p.before,'string');assert.equal(typeof p.after,'string');assert.equal(typeof p.reason,'string');
  if(p.kind==='paragraph')assert.equal(sha(p.before),original.paragraphSha256[p.originalParagraphId],p.id);
  if(p.kind==='footnote')assert.equal(p.before,notes.get(p.originalNoteId)?.text,p.id);
  if(p.appliedParagraphId)assert.ok(applied.has(p.appliedParagraphId),p.id);
 }
});
test('all proposal payloads target a preserved human paragraph or footnote and structural changes remain explicit',()=>{
 for(const p of guide.items){
  const applicable=typeof p.applyText==='string';assert.notEqual(applicable,typeof p.applyUnsupportedReason==='string',p.id);
  if(applicable)assert.ok(p.kind==='footnote'?notes.has(p.originalNoteId):paragraphs.has(p.originalParagraphId),p.id);
  if(['new_footnote','heading_insert','toc','layout','bibliography_insert'].includes(p.kind))assert.equal(applicable,false,p.id);
 }
 assert.equal(guide.items.filter(p=>p.kind==='new_footnote').length,9);
});
test('saved payloads exclude display deletion markers and unknown note identities',()=>{
 let deletions=0,linkedNotes=0;
 for(const p of guide.items.filter(x=>typeof x.applyText==='string')){
  assert.notEqual(p.applyText,'(삭제)',p.id);assert.doesNotMatch(p.applyText,/〔각주 \d+〕|\[\^[^\d]/,p.id);
  if(p.after==='(삭제)'){assert.equal(p.applyText,'',p.id);deletions++;}
  for(const m of p.applyText.matchAll(/\[\^(\d+)\]/g)){assert.ok(notes.has('fn-'+m[1].padStart(3,'0')),p.id);linkedNotes++;}
 }
 assert.ok(deletions>0);assert.ok(linkedNotes>0);
});
test('human edits use human recitation numbers and keep the external source own footnote number',()=>{
 for(const [id,human,final] of [['FN73-052',50,55],['FN73-097',95,101],['FN73-243',242,250]]){
  const p=guide.items.find(x=>x.id===id);assert.ok(p.after.includes(`주 ${final})`));assert.ok(p.applyText.includes(`주 ${human})`));
 }
 const p=guide.items.find(x=>x.id==='FN73-157');assert.match(p.after,/각주 167/);assert.match(p.applyText,/각주 167/);
});
