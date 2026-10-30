import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getLegalMentions} from '../src/legal-link-model.ts';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const pages=read('../src/citation-pages-v123.json'),links=read('../src/citation-links-v123.json'),manifest=read('../public/editions/v123/manifest.json');

test('v123 inheritance notes open the inspected printed pages in the correct edition-specific excerpts',()=>{
 const expected={
  'fn-112':{'s-61a1544db8a006d7':[[153,17]]},
  'fn-113':{'s-61a1544db8a006d7':[[81,15],[153,17],[154,18],[165,19],[166,20]],'s-practice1-2020':[[235,3],[236,4],[237,5]]},
  'fn-114':{'s-61a1544db8a006d7':[[82,16]],'s-practice1-2020':[[188,1],[189,2]]},
  'fn-115':{'s-8b043ecae2145ffe':[[1608,4],[1676,5],[1677,6],[1678,7],[1679,8],[1682,9],[1683,10]]},
  'fn-116':{'s-8b043ecae2145ffe':[[1683,10],[1684,11]]},
 };
 for(const [nid,refs] of Object.entries(expected))for(const [sid,locations] of Object.entries(refs)){
  assert.deepEqual(pages[nid][sid].pages.map(p=>[Number(p.printed),p.page]).sort((a,b)=>a[0]-b[0]),locations,`${nid}/${sid}`);
  const source=manifest.sources.find(s=>s.id===sid);assert.equal(source.assetUrl,`https://paper.lawinus.org/source-excerpts/v123/${sid}.pdf`);
  for(const [printed,page] of locations)assert.ok(source.pageMap.some(p=>p.page===page&&p.printedPages.includes(String(printed))));
  const ref=manifest.notes.find(n=>n.id===nid).sourceRefs.find(r=>r.sourceId===sid);assert.ok(ref);assert.equal(ref.targetPage,locations[0][1]);
 }
 assert.equal(manifest.notes.length,417);assert.equal(Object.keys(links.notes).length,417);
});

test('v123 new note law references distinguish civil procedure, execution, civil inheritance and bankruptcy',()=>{
 const expected={
  'fn-112':{'233':'civil-procedure','238':'civil-procedure','241':'civil-procedure'},
  'fn-113':{'31':'civil-execution','39':'civil-execution','1053':'civil'},
  'fn-114':{'52':'civil-execution'},
  'fn-115':{'1028':'civil','1034':'civil','1042':'civil'},
  'fn-116':{'299':'drba','300':'drba','307':'drba','308':'drba','384':'drba','389':'drba','415':'drba','1026':'civil'},
 };
 for(const [id,articles] of Object.entries(expected)){
  const mentions=getLegalMentions(links.notes[id].text,{contextId:id,edition:'v123'});
  for(const [article,law] of Object.entries(articles))assert.ok(mentions.some(m=>m.article===article&&m.lawId===law&&m.status==='current'),`${id}: ${law}/${article}`);
 }
});

test('v123 death section is inserted after the recovery discussion with five prose paragraphs and notes112 through116',()=>{
 const catalog=read('../src/paragraph-catalog-v123.json').paragraphs,guide=read('../src/revision-proposals-v123.json').items;
 const add=guide.find(p=>p.id==='ADD123-DEATH');assert.equal(add.kind,'paragraph_add');assert.equal(add.appliedParagraphIds.length,6);assert.equal(add.originalParagraphId,'P0469');assert.equal(add.applyText,undefined);
 const selected=add.appliedParagraphIds.map(id=>catalog.find(p=>p.id===id));assert.equal(selected[0].text,'4. 임대인 사망에 따른 집행절차의 처리');
 assert.equal(add.after,selected.map(p=>p.text).join('\n'));
 assert.deepEqual(selected.slice(1).flatMap(p=>Array.from(p.text.matchAll(/\[\^(\d+)\]/g),m=>Number(m[1]))),[112,113,114,115,116]);
 for(const p of guide.filter(p=>p.kind==='footnote_delete')){assert.equal(p.appliedNoteId,undefined);assert.equal(p.after,'');assert.equal(p.applyText,undefined);assert.ok(p.appliedParagraphIds.length);}
 assert.equal(manifest.inspectionRecord.appliedV123Tested,false);assert.equal(manifest.inspectionRecord.fivePercentTargetVerified,false);
});

test('v123 appendix draft supplementary provisions stay separate from enacted law',()=>{
 const mentions=getLegalMentions(links.notes['fn-416'].text,{contextId:'fn-416',edition:'v123'});
 const supplement=mentions.find(m=>m.article==='부칙:3');assert.ok(supplement);
 assert.equal(supplement.status,'proposal');assert.match(supplement.href,/edition=v123&paragraph=P1318/);
});
