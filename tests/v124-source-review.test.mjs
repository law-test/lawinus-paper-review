import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getLegalMentions} from '../src/legal-link-model.ts';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const guide=read('../src/revision-proposals.json').items,manifest=read('../public/editions/v124/manifest.json');
const links=read('../src/citation-links-v124.json'),pages=read('../src/citation-pages-v124.json');
const catalog=read('../src/paragraph-catalog-v124.json').paragraphs;
const noteFor=alias=>guide.find(p=>p.kind==='footnote_add'&&p.target===alias)?.appliedNoteId;
test('v124 new tables preserve four columns, exact row order and their title anchors',()=>{
 const tables=guide.filter(p=>p.kind==='table_add');assert.equal(tables.length,2);
 for(const table of tables){
  assert.ok(table.tableRows.length>=4);assert.ok(table.tableRows.every(row=>row.length===4));
  const rows=table.appliedParagraphIds.map(id=>catalog.find(p=>p.id===id));
  assert.ok(rows.every(p=>p?.kind==='table_row'));
  assert.equal(rows.map(p=>p.text).join('\n'),table.after);
  assert.deepEqual(rows.map(p=>p.order),rows.map(p=>p.order).toSorted((a,b)=>a-b));
  assert.equal(table.applyText,undefined);assert.ok(table.applyUnsupportedReason);
 }
});
test('v124 consulted book and official HUG citations open the inspected printed pages',()=>{
 for(const [alias,sid,wanted] of [
  ['H124_BOOKCASE','s-d9f1cc1bbaf5a44d',[[21,2]]],
  ['LOAN124-EXT','s-9181dc77e022e83e',[[27,3]]],
  ['LOAN124-RELIEF','s-9181dc77e022e83e',[[23,2],[27,3]]],
 ]){
  const id=noteFor(alias);assert.ok(id,alias);
  assert.deepEqual(pages[id][sid].pages.map(p=>[Number(p.printed),p.page]).toSorted((a,b)=>a[0]-b[0]),wanted);
  const source=manifest.sources.find(s=>s.id===sid);assert.equal(source.assetUrl,`https://paper.lawinus.org/source-excerpts/v124/${sid}.pdf`);
  assert.ok(links.notes[id].segments.some(s=>s.sourceId===sid&&s.page===wanted[0][1]));
 }
});
test('v124 H031 succession paragraphs and three notes retain one owner each',()=>{
 for(const alias of ['H031-CLAIM','H031-POSSESSION','H031-ESTATE']){
  const p=guide.find(p=>p.id==='ADD124-'+alias),n=noteFor(alias+'-NOTE');assert.ok(p&&n);
  assert.equal(p.appliedParagraphIds.length,1);
  const row=catalog.find(row=>row.id===p.appliedParagraphId);assert.equal(row.text,p.after);
  const marker=`[^${Number(n.slice(3))}]`;assert.ok(row.text.includes(marker));
  assert.equal(catalog.filter(row=>row.text.includes(marker)).length,1);
  assert.equal(p.applyText,undefined);
 }
});
test('v124 court rules distinguish Seoul existing full document from Suwon two-up excerpt',()=>{
 const id=noteFor('H031-ESTATE-NOTE');assert.ok(id);
 const seoul='s-112b24afb2bcddcf',suwon='s-0a887459850c09ab';
 assert.deepEqual(pages[id][seoul].pages, [{page:216,printed:'196'}]);
 assert.deepEqual(pages[id][suwon].pages,[{page:1,printed:'185'},{page:1,printed:'186'}]);
 assert.equal(manifest.sources.find(s=>s.id===seoul).storageDatasetId,'human-1021-1559');
 assert.equal(manifest.sources.find(s=>s.id===suwon).pages,1);
 const text=links.notes[id].text,mentions=getLegalMentions(text,{contextId:id,edition:'v124'});
 for(const citation of links.notes[id].segments.filter(s=>[seoul,suwon].includes(s.sourceId)))assert.ok(!mentions.some(m=>m.start<citation.end&&m.end>citation.start));
 assert.ok(text.includes('서울은 재단 포함의 예외를, 수원은 환가하지 않을 수 있음'));
});
test('v124 dated tax law and scheduled amendment references cannot masquerade as current law',()=>{
 const id=noteFor('TAX124-DATES'),text=links.notes[id].text;
 const mentions=getLegalMentions(text,{contextId:id,edition:'v124'});assert.ok(mentions.length>=4);assert.ok(mentions.every(m=>m.status==='historical'));
 const future=noteFor('H124_LHNOTE'),ft=links.notes[future].text;
 const at=ft.indexOf('시행예정');assert.ok(at>=0);
 assert.ok(!getLegalMentions(ft,{contextId:future,edition:'v124'}).some(m=>m.label==='제25조'&&m.start>at));
});
test('v124 Claude v093 source additions use their independently verified printed pages',()=>{
 const expected=[
  ['fn-003','s-f9aff5bb30c1ff81',[[104,2],[105,3],[106,4]]],
  ['fn-009','s-d453873d9c0223f4',[[7,2],[8,3],[9,4],[10,5]]],
  ['fn-208','s-10b194e85deed699',[[27,2],[28,3]]],
  ['fn-237','s-03bb661ffb4daf71',[[252,4],[253,5]]],
  ['fn-242','s-03bb661ffb4daf71',[[252,4]]],
  ['fn-258','s-03bb661ffb4daf71',[[145,2],[146,3]]],
  ['fn-259','s-03bb661ffb4daf71',[[471,6]]],
  ['fn-439','s-6b7a3fc8b161bc5d',[[538,23],[539,24]]],
 ];
 for(const [id,sid,wanted] of expected){
  assert.deepEqual(pages[id]?.[sid]?.pages.map(p=>[Number(p.printed),p.page]).toSorted((a,b)=>a[0]-b[0]),wanted,id);
  assert.ok(links.notes[id].segments.some(s=>s.sourceId===sid&&s.page===wanted[0][1]),id);
  assert.equal(manifest.sources.find(s=>s.id===sid).assetUrl,`https://paper.lawinus.org/source-excerpts/v124/${sid}.pdf`);
 }
});
test('v124 extension of commentary volume V preserves every prior excerpt-page identity',()=>{
 const old=read('../public/editions/v123/manifest.json').sources.find(s=>s.id==='s-6b7a3fc8b161bc5d');
 const current=manifest.sources.find(s=>s.id===old.id);
 assert.equal(old.pages,22);assert.equal(current.pages,24);
 assert.deepEqual(current.pageMap.slice(0,22),old.pageMap);
 assert.deepEqual(current.pageMap.slice(22),[{page:23,originalPage:559,printedPages:['538']},{page:24,originalPage:560,printedPages:['539']}]);
 assert.notEqual(old.assetUrl,current.assetUrl);
});
