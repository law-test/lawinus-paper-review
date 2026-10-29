import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {targetAt,validRect} from '../src/pdf-viewer-model.ts';
const read=name=>JSON.parse(readFileSync(new URL(`../src/${name}.json`,import.meta.url),'utf8'));
const legal=read('legal-pdf-targets'),citations=read('citation-links'),paragraphs=read('paragraph-catalog');
const precise=[...legal.targets,...citations.pdfTargets];
const ordinary=paragraphs.paragraphs.flatMap(p=>p.rects.map(r=>({...r,noteId:p.id,number:0,kind:'paragraph'})));
const action=t=>t?.linkId||t?.legalId||t?.noteId;

test('every exact source/statute region wins over its surrounding paragraph and adjacent references',()=>{
 const pages=new Map();
 for(const t of [...ordinary,...precise]){const p=pages.get(t.page)||[];p.push(t);pages.set(t.page,p);}
 assert.ok(legal.targets.length>0&&citations.pdfTargets.length>0);
 for(const t of precise){
  assert.ok(validRect(t.rect));assert.ok(Number.isInteger(t.page)&&t.page>0&&t.page<=266);
  const [a,b,c,d]=t.rect;
  const result=targetAt(pages.get(t.page),(a+c)/2,(b+d)/2);
  assert.equal(action(result),action(t),`wrong target at ${t.page}: ${t.title}`);
 }
});

test('all PDF statute links keep an official destination and the audited PDF identity',()=>{
 assert.equal(legal.pdfSha256,paragraphs.pdfSha256);
 const mentioned=new Set();
 for(const t of legal.targets){assert.ok(legal.mentions[t.legalId]);mentioned.add(t.legalId);}
 assert.equal(mentioned.size,Object.keys(legal.mentions).length);
 for(const [id,m] of Object.entries(legal.mentions)){
  const u=new URL(m.href,'https://paper.lawinus.org/');assert.equal(u.protocol,'https:',id);assert.ok(m.label.trim());
  if(m.href.startsWith('./')){assert.equal(m.status,'proposal',id);assert.equal(u.origin,'https://paper.lawinus.org');assert.equal(u.searchParams.get('edition'),'human80');assert.ok(paragraphs.paragraphs.some(p=>p.id===u.searchParams.get('paragraph')),id);}
  if(['proposal','historical','foreign','unresolved'].includes(m.status))assert.ok(!m.articleText,`${id} must not imply current Korean statutory text`);
 }
});
