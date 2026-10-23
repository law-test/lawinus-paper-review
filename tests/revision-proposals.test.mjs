import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const guide=JSON.parse(readFileSync(new URL('../src/revision-proposals.json',import.meta.url),'utf8'));
const original=JSON.parse(readFileSync(new URL('./fixtures/human-originals.json',import.meta.url),'utf8'));
const catalog=JSON.parse(readFileSync(new URL('../src/paragraph-catalog.json',import.meta.url),'utf8'));
const paragraphs=new Map(catalog.paragraphs.map(p=>[p.id,p]));
const movedTableRows=new Set(['P1091','P1100','P1119','P1126','P1136','P1154','P1161','P1169','P1188']);
const notes=new Map(original.footnotes.map(n=>[String(n.number),n]));
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');

test('all proposal payloads have an immutable human target and explicit applicability',()=>{
 for(const p of guide.items){
  const applicable=typeof p.applyText==='string';
  assert.notEqual(applicable,typeof p.applyUnsupportedReason==='string',p.id);
  if(/^P\d+$/.test(p.id)){
   const before=p.before.replace(/〔각주 (\d+)〕/g,'[^$1]');
   if(movedTableRows.has(p.id)){
    const header=paragraphs.get('P'+String(Number(p.id.slice(1))-1).padStart(4,'0'));
    const body=paragraphs.get(p.id);
    assert.equal(applicable,false,p.id);
    assert.equal(header.kind,'table_row',p.id);assert.equal(body.kind,'table_row',p.id);
    assert.equal(sha(header.text),original.paragraphSha256[header.id],p.id);
    assert.equal(sha(body.text),original.paragraphSha256[body.id],p.id);
    assert.equal(before,header.text+'\n\n'+body.text,p.id);
   }else assert.equal(sha(before),original.paragraphSha256[p.id],p.id);
  }else if(/^FN\d+$/.test(p.id)){
   const n=notes.get(p.id.slice(2));assert.ok(n,p.id);
   assert.equal(p.before.replace(/^각주\s*\d+:\s*/,''),n.text,p.id);
  }else assert.equal(applicable,false,p.id);
 }
});

test('all nine appendix table moves are manual and retain complete original table text',()=>{
 for(const id of movedTableRows){
  const p=guide.items.find(item=>item.id===id);assert.ok(p,id);
  assert.equal(p.applyText,undefined,id);
  assert.match(p.applyUnsupportedReason,/부록 이동/,id);
 }
});

test('saved proposal text excludes display-only deletion, layout instructions, and applied-version note labels',()=>{
 let deletions=0,linkedNotes=0;
 for(const p of guide.items.filter(x=>typeof x.applyText==='string')){
  assert.notEqual(p.applyText,'(삭제)',p.id);
  assert.doesNotMatch(p.applyText,/〔각주 \d+〕|각주 표시와 각주 설명의 첫머리를 같은 면에 배치한다\./,p.id);
  if(p.after==='(삭제)'){assert.equal(p.applyText,'',p.id);deletions++;}
  for(const m of p.applyText.matchAll(/\[\^([^\]]+)\]/g)){assert.ok(notes.has(m[1]),p.id+' '+m[1]);linkedNotes++;}
 }
 assert.ok(deletions>0);assert.ok(linkedNotes>0);
});

test('footnote re-citations keep human numbers even when display After uses applied-version numbers',()=>{
 for(const [id,human,applied] of [['FN22',21,22],['FN77',15,16],['FN189',34,36]]){
  const p=guide.items.find(x=>x.id===id);assert.ok(p,id);
  assert.ok(p.after.includes(`주 ${applied})`),id);
  assert.ok(p.applyText.includes(`주 ${human})`),id);
  assert.ok(!p.applyText.includes(`주 ${applied})`),id);
 }
});
