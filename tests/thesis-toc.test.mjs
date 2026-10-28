import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {currentTocId,visibleToc} from '../src/thesis-toc-model.ts';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const human=read('../src/thesis-toc-data.json'),applied=read('../src/thesis-toc-data-v112.json');
test('both contents catalogs are bound to their exact PDF editions and real paragraph locations',()=>{
 for(const [toc,suffix,pages] of [[human,'',262],[applied,'-v112',269]]){
  const catalog=read(`../src/paragraph-catalog${suffix}.json`),paragraphs=new Map(catalog.paragraphs.map(p=>[p.id,p]));
  assert.equal(toc.pageCount,pages);assert.equal(toc.pdfSha256,catalog.pdfSha256);assert.equal(new Set(toc.entries.map(e=>e.id)).size,toc.entries.length);
  for(const e of toc.entries){assert.ok(e.page>=1&&e.page<=pages);if(e.paragraphId)assert.equal(e.page,paragraphs.get(e.paragraphId)?.page,e.title);}
  for(let i=1;i<toc.entries.length;i++)assert.ok(toc.entries[i].page>=toc.entries[i-1].page);
 }
 assert.equal(applied.pdfSha256,'5aea4b86669ad1b58052b57c719956d88ae3285f98b8c5510fb1202705b5f655');
});
test('same title routes to each edition own pagination, including native front matter',()=>{
 const heading=(toc,title)=>toc.entries.find(e=>e.title===title);
 assert.equal(heading(human,'제1장 서론').page,20);assert.equal(heading(applied,'제1장 서론').page,19);
 assert.equal(heading(human,'세부목차').page,12);assert.equal(heading(applied,'세부목차').page,11);
 assert.equal(heading(human,'일러두기').page,19);assert.equal(heading(applied,'일러두기').page,18);
 assert.ok(heading(applied,'제5장 결론').page>heading(human,'제5장 결론').page);
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
