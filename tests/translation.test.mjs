import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {validateTranslation,translationPageAt,translationNoteText} from '../src/translation-model.ts';
const registry=JSON.parse(readFileSync(new URL('../src/source-translations.json',import.meta.url),'utf8'));
const data=registry.sources.map(e=>[e,JSON.parse(readFileSync(new URL('../public/translations/'+e.file,import.meta.url),'utf8'))]);
test('every registered translation has all pages and a source/translation pair for every block',()=>{
 for(const [entry,doc] of data){const result=validateTranslation(doc,entry);assert.equal(result.pages.length,entry.totalPages);assert.deepEqual(result.pages.map(p=>p.pdfPage),Array.from({length:entry.totalPages},(_,i)=>i+1));}
 assert.equal(data.find(([e])=>e.language==='en')[1].pages.length,48);
 assert.equal(data.find(([e])=>e.language==='de')[0].scope,'보유 원문 Rn. 4–6 및 각주 18–19');
});
test('a missing final page, duplicate page, wrong source, or empty translation is rejected',()=>{
 const [entry,original]=data[0];
 for(const modify of [d=>d.pages.pop(),d=>d.pages[1].pdfPage=1,d=>d.sourceSha256='0'.repeat(64),d=>d.pages[0].blocks[0].translation='']){
   const doc=structuredClone(original);modify(doc);assert.throws(()=>validateTranslation(doc,entry));
 }
});
test('published Korean translations are not misrepresented as German or Japanese originals',()=>{
 assert.equal(registry.sources.some(e=>e.sourceId==='s-92ee28b9ae50b4f6'),false);
 assert.equal(registry.sources.some(e=>e.sourceId==='s-ecd25c043c28790b'),false);
 assert.deepEqual(registry.sources.find(e=>e.language==='de').noteIds,['fn-226']);
});
test('continuous translation scroll finds the current page including the final page',()=>{
 const tops=[{page:1,top:0},{page:2,top:730},{page:3,top:1990}];
 assert.equal(translationPageAt(tops,0),1);assert.equal(translationPageAt(tops,729),1);assert.equal(translationPageAt(tops,730),2);assert.equal(translationPageAt(tops,3000),3);
});
test('translator notes remain separate from the source and translated body',()=>{
 const english=data.find(([e])=>e.language==='en')[1];
 assert.ok(english.pages.some(p=>p.blocks.some(b=>typeof b.translatorNote==='string')));
 assert.ok(english.pages.some(p=>p.translatorNotes?.length));
 assert.equal(translationNoteText({note:'원문 표기 유지'}),'원문 표기 유지');
 assert.equal(translationNoteText('원문 표기 유지'),'원문 표기 유지');
});
