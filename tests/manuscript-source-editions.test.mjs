import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {getCitationSegments,citationPdfTargets} from '../src/citation-link-model.ts';
import {getLegalMentions} from '../src/legal-link-model.ts';
import {targetAt,validRect,targetKey} from '../src/pdf-viewer-model.ts';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
for(const [edition,suffix,count,total] of [['human77','',348,262],['v112','-v112',349,269]]){
 const citations=read(`../src/citation-links${suffix}.json`),pages=read(`../src/citation-pages${suffix}.json`),legal=read(`../src/legal-pdf-targets${suffix}.json`),paragraphs=read(`../src/paragraph-catalog${suffix}.json`),manifest=read(`../public/editions/${edition}/manifest.json`),translations=read(`../src/source-translations${suffix}.json`);
 test(`${edition}: all ${count} current footnotes retain bounded distinct citation spans and correct source membership`,()=>{
  assert.equal(Object.keys(citations.notes).length,count);assert.equal(manifest.notes.length,count);
  const sourceMap=new Map(manifest.sources.map(s=>[s.id,s]));
  for(const note of manifest.notes){
   assert.equal(citations.notes[note.id].text,note.text);let end=0;
   for(const segment of getCitationSegments(note.id,note.text,edition)){
    assert.ok(segment.start>=end&&segment.end>segment.start&&segment.end<=note.text.length,`${note.id}: range`);end=segment.end;
    assert.equal(segment.title,note.text.slice(segment.start,segment.end));
    if(segment.status==='available'){
     assert.ok(sourceMap.has(segment.sourceId)||translations.sources.some(s=>s.sourceId===segment.sourceId),`${note.id}: ${segment.sourceId}`);
     assert.ok(Number.isInteger(segment.page)&&segment.page>0);
     const source=sourceMap.get(segment.sourceId);if(source?.pages)assert.ok(segment.page<=source.pages);
    }else {assert.equal(segment.sourceId,undefined);if(segment.href)assert.equal(new URL(segment.href).protocol,'https:');}
   }
   assert.deepEqual(getCitationSegments(note.id,note.text+' ',edition),[]);
  }
  for(const [note,refs] of Object.entries(pages))for(const [source,entry] of Object.entries(refs))for(const page of entry.pages){
   assert.ok(page.page>0);assert.ok(!sourceMap.get(source)?.pages||page.page<=sourceMap.get(source).pages,`${note}/${source}`);
  }
 });
 test(`${edition}: source and law click regions match this PDF identity and win over broad paragraph areas`,()=>{
  assert.equal(legal.pdfSha256,paragraphs.pdfSha256);assert.equal(citations.humanPdfSha256,paragraphs.pdfSha256);
  const precise=[...citationPdfTargets(edition),...legal.targets];const targets=[...paragraphs.paragraphs.flatMap(p=>p.rects.map(r=>({...r,noteId:p.id,kind:'paragraph',number:0}))),...precise];
  const byPage=new Map();for(const t of targets){const arr=byPage.get(t.page)||[];arr.push(t);byPage.set(t.page,arr);}
  assert.equal(new Set(citationPdfTargets(edition).map(targetKey)).size,citationPdfTargets(edition).length);
  for(const target of precise){
   assert.ok(validRect(target.rect));assert.ok(target.page>=1&&target.page<=total);
   const size=manifest.pages[target.page-1],[a,b,c,d]=target.rect;assert.ok(a>=0&&b>=0&&c<=size.width&&d<=size.height);
   const hit=targetAt(byPage.get(target.page),(a+c)/2,(b+d)/2);assert.equal(hit?.linkId||hit?.legalId,target.linkId||target.legalId,`${target.page}: ${target.title}`);
  }
 });
 test(`${edition}: statutes retain explicit jurisdiction, amendment status and newly reviewed paragraph scope`,()=>{
  for(const p of paragraphs.paragraphs){
   for(const m of getLegalMentions(p.text,{contextId:p.id,edition})){
    if(m.status==='current')assert.ok(m.lawId&&m.articleText,`${p.id}: ${m.label}`);
    if(m.status==='proposal')assert.equal(m.articleText,undefined);
   }
  }
  const abstract=paragraphs.paragraphs.find(p=>p.text.startsWith('또한 개인회생절차 중 목록기재채권'));
  assert.ok(getLegalMentions(abstract.text,{contextId:abstract.id,edition}).every(m=>m.lawId==='drba'));
  assert.equal(getLegalMentions('제615조')[0].status,'unresolved');
 });
 test(`${edition}: commentary titles keep their own source and unrelated authors never share a profile link`,()=>{
  const special=citations.notes[edition==='human77'?'fn-190':'fn-191'];
  const specialTitle=special.segments.find(s=>s.title.startsWith('박진수,')&&s.title.includes('특별해설'));
  assert.equal(specialTitle?.sourceId,'s-f95de22aae05230f');
  const restitution=citations.notes[edition==='human77'?'fn-196':'fn-197'];
  assert.ok(restitution.segments.some(s=>s.title.startsWith('양형우,')&&s.title.includes('2020다277481')&&s.sourceId==='s-b36c7120f0c98717'));
  assert.ok(restitution.segments.some(s=>s.title.startsWith('대법원')&&s.sourceId==='s-110ad3aca2ce76cb'));
  for(const note of Object.values(citations.notes))for(const segment of note.segments){
   if(segment.href?.includes('leekyung.kim'))assert.ok(segment.title.startsWith('김이경,'));
   assert.ok(segment.sourceId||segment.href,`${note.text}: empty citation destination`);
  }
 });
 test(`${edition}: existing public assets and translation IDs do not inherit old manuscript footnote numbers`,()=>{
  for(const source of manifest.sources){assert.equal(source.storageDatasetId,'human-1021-1559');assert.ok(source.assetUrl.endsWith('/assets/'+source.id));assert.ok(source.noteIds.every(id=>citations.notes[id]));}
  for(const translation of translations.sources)for(const id of translation.noteIds)assert.ok(citations.notes[id].segments.some(s=>s.sourceId===translation.sourceId));
  const german=translations.sources.find(s=>s.language==='de');assert.deepEqual(german.noteIds,[edition==='human77'?'fn-317':'fn-318']);
  for(const note of Object.values(citations.notes))for(const segment of note.segments)if(segment.title.includes('계약법과 도산법')){
   assert.equal(segment.status,'unavailable');assert.equal(segment.href,'https://www.kyunginp.co.kr/books/7378/');assert.equal(segment.sourceId,undefined);
  }
 });
}
test('FAQ answer prose is preserved and all manuscript evidence retains an explicit legacy destination',()=>{
 const current=read('../src/thesis-faq.json'),old=read('./fixtures/legacy1021/thesis-faq.json');
 assert.equal(current.items.length,300);assert.deepEqual(current.items.map(x=>[x.id,x.category,x.question,x.answer]),old.items.map(x=>[x.id,x.category,x.question,x.answer]));
 const legacyHtml=readFileSync(new URL('../public/editions/legacy1021/proposals.html',import.meta.url),'utf8');
 for(const item of current.items)for(const source of item.sources){
  assert.ok(!/^\.\/\?(?:proposal|paragraph|note)=/.test(source.href));
  if(source.href.includes('/legacy1021/proposals.html#'))assert.ok(legacyHtml.includes('id="'+source.href.split('#')[1]+'"'));
  if(source.href.includes('/legacy1021/manuscript.pdf'))assert.ok(existsSync(new URL('../public/editions/legacy1021/manuscript.pdf',import.meta.url)));
 }
});
