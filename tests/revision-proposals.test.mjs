import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const guide=read('../src/revision-proposals.json'),original=read('./fixtures/human-originals.json');
const release=read('./fixtures/edition-release282.json');
const paragraphs=new Map(read('../src/paragraph-catalog.json').paragraphs.map(p=>[p.id,p]));
const applied=new Map(read('../src/paragraph-catalog-v122.json').paragraphs.map(p=>[p.id,p]));
const notes=new Map(original.footnotes.map(n=>[n.id,n]));
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
test('v122 keeps every approved human80 instruction with separate original and applied navigation',()=>{
 assert.equal(guide.version,'v122');assert.equal(guide.baseline,'human-1029-1629');assert.equal(guide.items.length,release.guide.items);
 assert.equal(new Set(guide.items.map(p=>p.id)).size,release.guide.items);
 for(const p of guide.items){
  assert.ok(p.humanPages.length&&p.humanPages.every(n=>n>=1&&n<=release.human80.pages),p.id);
  assert.ok(p.appliedPages.length&&p.appliedPages.every(n=>n>=1&&n<=release.v122.pages),p.id);
  assert.equal(p.page,p.humanPage,p.id);assert.equal(typeof p.before,'string');assert.equal(typeof p.after,'string');assert.equal(typeof p.reason,'string');
  if(['paragraph','paragraph_split'].includes(p.kind)){
   assert.equal(sha(p.before),original.paragraphSha256[p.originalParagraphId],p.id);
   assert.equal(p.after,p.appliedParagraphIds.map(id=>applied.get(id).text).join('\n\n'),p.id);
  }
  if(p.kind==='footnote')assert.equal(p.before,notes.get(p.originalNoteId)?.text,p.id);
  if(p.appliedParagraphId)assert.ok(applied.has(p.appliedParagraphId),p.id);
 }
});
test('all proposal payloads target a preserved human paragraph or footnote and structural changes remain explicit',()=>{
 for(const p of guide.items){
  const applicable=typeof p.applyText==='string';assert.notEqual(applicable,typeof p.applyUnsupportedReason==='string',p.id);
  if(applicable)assert.ok(p.kind==='footnote'?notes.has(p.originalNoteId):paragraphs.has(p.originalParagraphId),p.id);
  if(['new_footnote','heading_insert','toc','layout','bibliography_insert','bibliography_add'].includes(p.kind)||p.appliedParagraphIds.length>1&&['paragraph','paragraph_split'].includes(p.kind))assert.equal(applicable,false,p.id);
 }
 for(const [kind,count] of Object.entries(release.guide.kinds))assert.equal(guide.items.filter(p=>p.kind===kind).length,count);
});
test('saved payloads exclude display deletion markers and unknown note identities',()=>{
 let deletions=0,linkedNotes=0;
 for(const p of guide.items.filter(x=>typeof x.applyText==='string')){
  assert.notEqual(p.applyText,'(삭제)',p.id);assert.doesNotMatch(p.applyText,/〔각주 \d+〕|\[\^[^\d]/,p.id);
  if(p.after==='(삭제)'||p.kind==='delete_paragraph'){assert.equal(p.applyText,'',p.id);deletions++;}
  for(const m of p.applyText.matchAll(/\[\^(\d+)\]/g)){assert.ok(notes.has('fn-'+m[1].padStart(3,'0')),p.id);linkedNotes++;}
 }
 assert.equal(deletions,release.guide.kinds.delete_paragraph||0);assert.ok(linkedNotes>0);
});
test('the corrected commentary recitation targets its first full bibliography without changing original text',()=>{
 const p=guide.items.find(x=>x.originalNoteId==='fn-306');assert.ok(p);
 assert.match(p.before,/주 27\)/);assert.match(p.after,/주 30\)/);assert.match(p.applyText,/주 30\)/);
 assert.equal(notes.get('fn-306').text,p.before);assert.match(notes.get('fn-030').text,/주석\s*채무자회생법/);
});
