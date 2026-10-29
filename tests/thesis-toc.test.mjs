import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {currentTocId,visibleToc} from '../src/thesis-toc-model.ts';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const release=read('./fixtures/edition-release280.json');
const human=read('../src/thesis-toc-data.json'),applied=read('../src/thesis-toc-data-v120.json');
test('both contents catalogs are bound to their exact PDF editions and real paragraph locations',()=>{
 for(const [toc,suffix,pages] of [[human,'',release.human80.pages],[applied,'-v120',release.v120.pages]]){
  const catalog=read(`../src/paragraph-catalog${suffix}.json`),paragraphs=new Map(catalog.paragraphs.map(p=>[p.id,p]));
  assert.equal(toc.pageCount,pages);assert.equal(toc.pdfSha256,catalog.pdfSha256);assert.equal(new Set(toc.entries.map(e=>e.id)).size,toc.entries.length);
  for(const e of toc.entries){assert.ok(e.page>=1&&e.page<=pages);if(e.paragraphId)assert.equal(e.page,paragraphs.get(e.paragraphId)?.page,e.title);}
  for(let i=1;i<toc.entries.length;i++)assert.ok(toc.entries[i].page>=toc.entries[i-1].page);
 }
 assert.equal(applied.pdfSha256,release.v120.pdfSha256);assert.equal(human.pdfSha256,release.human80.pdfSha256);
});
test('same title routes to each edition own pagination, including native front matter',()=>{
 const heading=(toc,title)=>toc.entries.find(e=>e.title===title);
 for(const [ed,toc] of [['human80',human],['v120',applied]])for(const [title,page] of Object.entries(release[ed].frontPages))assert.equal(heading(toc,title).page,page,ed+':'+title);
});
test('search preserves ancestors and details while the short contents mode stays compact',()=>{
 for(const toc of [human,applied]){
  assert.ok(visibleToc(toc.entries,'',false).every(e=>e.level<=2));
  assert.equal(visibleToc(toc.entries,'',true).length,toc.entries.length);
  const found=visibleToc(toc.entries,'변제계획의 기재사항',false);assert.ok(found.length>1);assert.ok(found.some(e=>e.title.includes('변제계획의 기재사항')));
  assert.deepEqual(visibleToc(toc.entries,'존재하지않는목차',true),[]);
 }
});
test('same-page selected headings remain stable and pages before the document have no active item',()=>{
 for(const toc of [human,applied]){const chapter=toc.entries.find(e=>e.title==='제1장 서론');assert.equal(currentTocId(toc.entries,chapter.page,chapter.id),chapter.id);assert.equal(currentTocId(toc.entries,0),undefined);}
});
