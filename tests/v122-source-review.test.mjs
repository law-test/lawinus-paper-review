import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));

test('v122 newly cited book pages are matched to the inspected printed pages, preserving earlier excerpts',()=>{
 const pages=read('../src/citation-pages-v122.json'),manifest=read('../public/editions/v122/manifest.json');
 for(const [note,sid,expected] of [
  ['fn-089','s-61a1544db8a006d7',[[376,5],[377,6]]],
  ['fn-171','s-61a1544db8a006d7',[[447,13],[459,14]]],
  ['fn-115','s-631717f62f824b53',[[59,12],[64,13],[84,14],[85,15]]],
  ['fn-065','s-8b043ecae2145ffe',[[1166,2],[1185,3]]],
  ['fn-171','s-8b043ecae2145ffe',[[966,1]]],
 ]){
  assert.deepEqual(pages[note][sid].pages.map(p=>[Number(p.printed),p.page]).sort((a,b)=>a[0]-b[0]),expected,note+'/'+sid);
  const source=manifest.sources.find(s=>s.id===sid);
  for(const [printed,page] of expected)assert.ok(source.pageMap.some(p=>p.page===page&&p.printedPages.includes(String(printed))));
  const ref=manifest.notes.find(n=>n.id===note).sourceRefs.find(r=>r.sourceId===sid);
  assert.deepEqual([...new Set(ref.scope.split('·').map(Number))].sort((a,b)=>a-b),expected.map(r=>r[0]));
 }
 const old=read('../public/editions/v121/manifest.json');
 for(const sid of ['s-61a1544db8a006d7','s-631717f62f824b53']){
  const before=old.sources.find(s=>s.id===sid),after=manifest.sources.find(s=>s.id===sid);
  assert.deepEqual(after.pageMap.slice(0,before.pageMap.length),before.pageMap);
  assert.notEqual(after.assetUrl,before.assetUrl);
 }
});

test('v122 preserves every unchanged citation record, including the prior corrected footnote355 explanation',()=>{
 const changed=new Set(['fn-065','fn-089','fn-093','fn-115','fn-147','fn-171']);
 for(const stem of ['citation-links','citation-pages','citation-explanations']){
  let a=read(`../src/${stem}-v121.json`),b=read(`../src/${stem}-v122.json`);if(stem==='citation-links'){a=a.notes;b=b.notes;}
  for(const [id,record] of Object.entries(a))if(!changed.has(id))assert.deepEqual(b[id],record,stem+'/'+id);
 }
 const manifest=read('../public/editions/v122/manifest.json');
 assert.equal(manifest.footnotes,444);assert.equal(manifest.inspectionRecord.appliedV122Tested,false);assert.equal(manifest.additionalSourceReview.fullBooksRead,false);
});
