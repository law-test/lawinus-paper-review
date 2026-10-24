import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {getCitationSegments,citationPdfTargets} from '../src/citation-link-model.ts';
import {targetAt,targetKey,validRect} from '../src/pdf-viewer-model.ts';
const data=JSON.parse(readFileSync(new URL('../src/citation-links.json',import.meta.url),'utf8'));
const segments=id=>getCitationSegments(id,data.notes[id].text);
const at=(id,text)=>segments(id).find(s=>s.start<=data.notes[id].text.indexOf(text)&&s.end>data.notes[id].text.indexOf(text));

test('three references in a single footnote open their own sources and audited first pages',()=>{
 assert.deepEqual(['김제완,','김제완·손유은, 「한국','김제완·손유은, 「인구'].map(t=>{const s=at('fn-003',t);return [s.sourceId,s.page];}),[
  ['s-8bfba7bee89ac78b',4],['s-b76d05fc940d3eea',10],['s-eddc102f0af4fcb0',7]]);
 assert.equal(at('fn-003','159~160면').page,25);
 assert.notEqual(at('fn-004','문윤상').sourceId,at('fn-004','김제완').sourceId);
});
test('same-book chapters and separate excerpts retain their distinct source pages',()=>{
 assert.deepEqual(['제589조','제600조','제581조'].map(t=>at('fn-026',t).page),[8,10,3]);
 assert.deepEqual(['제580조','제615조','제600조'].map(t=>at('fn-198',t).page),[1,18,10]);
 assert.equal(at('fn-059','407~410').sourceId,'s-271f9b39d98feb1d');
 assert.equal(at('fn-059','473~475').sourceId,'s-37995022a56c9564');
 assert.deepEqual(['546면','170~171면'].map(t=>at('fn-191',t).page),[7,1]);
 assert.deepEqual(['제443호','제442호'].map(t=>at('fn-243',t).page),[286,284]);
});
test('a case embedded in an article title is independent from the article around it',()=>{
 assert.equal(at('fn-052','조인영').sourceId,'s-494797ac64a6f53d');
 assert.equal(at('fn-052','2017다226629').sourceId,'s-1b48e11e8da90903');
 assert.equal(at('fn-052','315~325면').sourceId,'s-494797ac64a6f53d');
});
test('unavailable articles, terms and secondary originals never inherit an adjacent held source',()=>{
 for(const [id,text] of [['fn-067','한국주택금융공사'],['fn-067','SGI서울보증'],['fn-076','이홍민'],['fn-076','장보은'],['fn-022','법원공무원교육원'],['fn-113','87다카98'],['fn-197','전병서']]){
  const s=at(id,text);assert.equal(s.status,'unavailable');assert.equal(s.sourceId,undefined);
 }
 assert.equal(at('fn-067','주택도시보증공사').sourceId,'s-eb8aa37aabf472f3');
 assert.equal(at('fn-226','Sven-Holger').sourceId,'t-undritz-ins165');
 assert.equal(at('fn-226','Reinhard Bork').sourceId,'s-92ee28b9ae50b4f6');
});
test('edited footnotes cannot reuse offsets from the original text',()=>{
 const text=data.notes['fn-003'].text;
 for(const value of ['',text+' ',text.replace('김제완','김철수')])assert.deepEqual(getCitationSegments('fn-003',value),[]);
 assert.deepEqual(getCitationSegments('fn-missing',text),[]);
 const copy=segments('fn-003');copy[0].page=999;assert.equal(segments('fn-003')[0].page,4);
});
test('all 246 audited notes have bounded non-overlapping spans; continuation targets retain pages',()=>{
 assert.equal(Object.keys(data.notes).length,246);
 for(const [id,note] of Object.entries(data.notes)){
  let end=0;
  for(const s of segments(id)){assert.ok(s.start>=end&&s.end>s.start&&s.end<=note.text.length);end=s.end;assert.equal(!!s.sourceId,s.status==='available');assert.ok(Number.isInteger(s.page)&&s.page>0);}
 }
 const targets=citationPdfTargets();assert.equal(new Set(targets.map(targetKey)).size,targets.length);
 for(const target of targets){assert.ok(validRect(target.rect));assert.ok(target.page>=1&&target.page<=279);assert.ok(segments(target.noteId).some(s=>s.linkId===target.linkId));}
 assert.ok(targets.some(t=>t.noteId==='fn-008'&&t.page===23));
 assert.ok(targets.some(t=>t.noteId==='fn-106'&&t.page===89));
 assert.ok(targets.some(t=>t.noteId==='fn-208'&&t.page===190));
});
test('exact citation targets beat broad note/proposal areas and preserve distinct keyboard keys',()=>{
 const citation=citationPdfTargets().find(t=>t.noteId==='fn-003');
 const [x0,y0,x1,y1]=citation.rect,x=(x0+x1)/2,y=(y0+y1)/2;
 const broad={...citation,kind:'footnote-text',rect:[x-1,y-1,x+1,y+1],linkId:undefined};
 assert.equal(targetAt([broad,citation],x,y),citation);
 const legal={...citation,kind:'legal',legalId:'a',rect:[x-0.5,y-0.5,x+0.5,y+0.5]};
 assert.equal(targetAt([broad,citation,legal],x,y),legal);
 assert.notEqual(targetKey(citation),targetKey({...citation,linkId:'different-reference'}));
 assert.notEqual(targetKey(citation),targetKey({...citation,sourcePage:99}));
 assert.equal(targetAt([citation],x1+1,y),undefined);
});
