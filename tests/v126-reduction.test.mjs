import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getLegalMentions} from '../src/legal-link-model.ts';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const current=read('../public/editions/v126/manifest.json');
const old=read('../public/editions/v124/manifest.json');
const guide=read('../src/revision-proposals.json').items;
const catalog=read('../src/paragraph-catalog-v126.json').paragraphs;
const citations=read('../src/citation-links-v126.json');
const pages=read('../src/citation-pages-v126.json');

test('v126 cap measures every physical PDF page including all front and back matter',()=>{
 assert.ok(Number.isInteger(current.physicalPages)&&current.physicalPages>0&&current.physicalPages<=200);
 assert.equal(current.physicalPages,current.pageCount);
 assert.equal(current.physicalPages,current.pages.length);
 assert.equal(current.meta.physicalPages,current.physicalPages);
 assert.equal(current.pageLimit.maximum,200);
 for(const word of ['표지','초록','목차','각주','참고문헌','부록'])assert.ok(current.pageLimit.scope.includes(word));
 assert.equal(current.pageLimit.verifiedFromActualPdf,true);
});
test('absorbed instructions navigate to a surviving merged paragraph without offering isolated deletion',()=>{
 const absorbed=guide.filter(p=>p.appliedLocationKind==='absorbed-into-merged-paragraph');
 assert.ok(absorbed.length>0);
 for(const row of absorbed){
  assert.equal(row.after,'');assert.equal(row.applyText,undefined);assert.match(row.applyUnsupportedReason,/통합/);
  assert.ok(row.appliedParagraphIds.length>0);
  for(const id of row.appliedParagraphIds)assert.ok(catalog.some(p=>p.id===id),row.id);
  assert.ok(row.appliedPages.every(page=>page>0&&page<=current.physicalPages));
 }
});
test('compression preserves all 442 note owners and citation character boundaries',()=>{
 assert.equal(current.notes.length,442);assert.equal(Object.keys(citations.notes).length,442);
 for(const note of current.notes){
  assert.equal(note.bodyContexts.length,1,note.id);
  const owners=catalog.filter(p=>p.text.includes(`[^${note.number}]`));assert.equal(owners.length,1,note.id);
  assert.equal(owners[0].id,note.bodyContexts[0].id);
  const linked=citations.notes[note.id];assert.equal(linked.text,note.text);
  for(const segment of linked.segments)assert.equal(note.text.slice(segment.start,segment.end),segment.title,note.id);
 }
});
test('v126 preserves the prior edition asset URL and printed-page identity for every reused source',()=>{
 const prior=new Map(old.sources.map(s=>[s.id,s]));
 for(const source of current.sources){
  const original=prior.get(source.id);assert.ok(original,source.id);
  for(const key of ['assetUrl','storageDatasetId','pages','pageMap'])assert.deepEqual(source[key],original[key],`${source.id} ${key}`);
 }
});
test('the compressed tenant-death note retains both independently checked court-rule locators',()=>{
 const n=guide.find(p=>p.target==='H031-ESTATE-NOTE');assert.ok(n?.appliedNoteId);
 assert.deepEqual(pages[n.appliedNoteId]['s-112b24afb2bcddcf'].pages,[{page:216,printed:'196'}]);
 assert.deepEqual(pages[n.appliedNoteId]['s-0a887459850c09ab'].pages,[{page:1,printed:'185'},{page:1,printed:'186'}]);
});
test('the reviewer score and historical AI inspections remain distinct in v126',()=>{
 assert.equal(current.reviewerAssessment.score,90);
 assert.equal(current.reviewerAssessment.components.reduce((n,c)=>n+c.score,0),90);
 assert.match(current.reviewerAssessment.limitations,/공식 심사점수.*AI생성검사/);
 assert.equal(current.inspectionRecord.appliedV126Tested,false);
 assert.equal(current.inspectionRecord.fivePercentTargetVerified,false);
 assert.equal(read('../deployment.json').aiEnabled,false);
});
test('compressed legal references preserve branch numbers, foreign jurisdiction and relative paragraph owners',()=>{
 const samples=[['P0375','제3조의5','housing','3-5','current'],['P0321','제1항 제2호','drba','600','current'],['P0759','제2항','drba','600','current'],['P0844','제4항','drba','603','current'],['P0925','제2항안','drba','415-4','proposal'],['fn-411','제30d조 제1항','de-execution','30d','foreign'],['fn-180','제16조 제6호','court-stamp-rule','16','current']];
 for(const [id,label,law,article,status] of samples){
  const text=id.startsWith('fn-')?citations.notes[id].text:catalog.find(p=>p.id===id).text;
  const found=getLegalMentions(text,{contextId:id,edition:'v126'}).filter(m=>m.label===label);
  assert.ok(found.length,`${id} ${label}`);
  for(const m of found){assert.equal(m.lawId,law);assert.equal(m.article,article);assert.equal(m.status,status);}
 }
});
test('consecutive retained footnotes have separate clickable markers after paragraph merging',()=>{
 for(const [a,b] of [[265,266],[296,297],[330,331]]){
  const marker=n=>current.notes.find(x=>x.number===n).clickTargets.find(t=>t.kind==='body-marker');
  const one=marker(a),two=marker(b);assert.equal(one.page,two.page);
  assert.ok(one.rect[2]<=two.rect[0]+0.1,`${a}/${b} distinct adjacent glyph bounds`);
 }
 const range=citations.notes['fn-411'].segments.find(s=>s.sourceId==='s-92ee28b9ae50b4f6'&&s.title==='164~165면');
 assert.equal(range.page,3);
 assert.ok(pages['fn-411']['s-92ee28b9ae50b4f6'].pages.some(p=>p.printed==='164'&&p.page===3));
 assert.ok(pages['fn-411']['s-92ee28b9ae50b4f6'].pages.some(p=>p.printed==='165'&&p.page===4));
});
