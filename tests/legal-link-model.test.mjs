import test from 'node:test';
import assert from 'node:assert/strict';
import {getLegalMentions,getLegalLaw,legalArticleHref,getLegalMentionDetails} from '../src/legal-link-model.ts';
import corpus from './fixtures/legal-model-cases263.json' with {type:'json'};
import explanations from '../src/citation-explanations.json' with {type:'json'};

test('unnamed articles require an evidenced context, not a global DRBA default',()=>{
 assert.equal(getLegalMentions('제615조')[0].status,'unresolved');
 assert.equal(getLegalMentions('제615조','P0942')[0].lawId,'drba');
 assert.equal(getLegalMentions('민법 제615조','P0942')[0].lawId,'civil');
});
test('explicit statute overrides a previously audited occurrence; article branch remains exact',()=>{
 assert.equal(getLegalMentions('민법 제3조의3','P0503')[0].lawId,'civil');
 assert.match(legalArticleHref(getLegalLaw('housing'),'3-2'),/joBrNo=02&joNo=0003/);
 assert.match(legalArticleHref(getLegalLaw('housing'),'3'),/joBrNo=00&joNo=0003/);
});
test('citation chains keep their explicitly named statute',()=>{
 const result=getLegalMentions('주택임대차보호법 제3조·제3조의 2 및 제8조');
 assert.deepEqual(result.map(m=>[m.lawId,m.article]),[['housing','3'],['housing','3-2'],['housing','8']]);
});
test('proposed articles and new paragraphs never expose current-law text',()=>{
 const r=getLegalMentions('채무자회생법 제415조의3 및 제615조 제4항, 제5항, 제3항, 제611조 제1항 제4호');
 assert.deepEqual(r.map(m=>m.status),['proposal','proposal','proposal','current','proposal']);
 for(const m of r.filter(m=>m.status==='proposal'))assert.equal(m.articleText,undefined);
 for(const m of r.filter(m=>m.status==='proposal'))assert.equal(getLegalMentionDetails(m).article,undefined);
 assert.ok(r[3].articleText.includes('제615조'));
});
test('relative paragraphs follow the latest article, and never cross a blank paragraph',()=>{
 const r=getLegalMentions('채무자회생법 제615조 제4항 및 제3항. 제625조 제2항 및 제1항.\n\n제4항');
 assert.deepEqual(r.map(m=>[m.article,m.paragraph]),[['615','4'],['615','3'],['625','2'],['625','1']]);
 assert.equal(getLegalMentions('제3항').length,0);
});
test('historical law and supplementary provisions are never mistaken for the current main article',()=>{
 const old=getLegalMentions('구 신탁법 제21조')[0];
 assert.equal(old.status,'historical');assert.equal(old.articleText,undefined);
 const appendix=getLegalMentions('국세기본법 부칙 제3조')[0];
 assert.equal(appendix.article,'부칙:3');assert.equal(appendix.status,'historical');assert.equal(appendix.articleText,undefined);
});
test('foreign references retain their official jurisdiction and all explicit series numbers',()=>{
 const german=getLegalMentions('독일 강제경매 및 강제관리법 제30d조')[0];
 assert.equal(german.lawId,'de-execution');assert.match(german.href,/zvg\/__30d.html/);
 const us=getLegalMentions('11 U.S.C. §§ 361, 362(c), (d), (g), 1306, 1327');
 assert.ok(us.every(m=>m.lawId==='us-bankruptcy'));
 assert.deepEqual(us.map(m=>m.article),['361','362','1306','1327']);
 assert.equal(us[1].label,'362(c), (d), (g)');
 assert.match(us[1].href,/section362/);
 const english=getLegalMentions('Article 600 of the Debtor Rehabilitation and Bankruptcy Act')[0];
 assert.equal(english.lawId,'drba');assert.equal(english.status,'current');
});
test('contract terms, court practice documents, and internal report headings are not national statutes',()=>{
 assert.deepEqual(getLegalMentions('보증약관 제3조 및 제4조','fn-067'),[]);
 assert.deepEqual(getLegalMentions('서울회생법원 실무준칙 제2조'),[]);
 assert.deepEqual(getLegalMentions('Claude v085 §3-1'),[]);
});
test('housing priority exposes the verified specific implementing articles',()=>{
 const m=getLegalMentions('주택임대차보호법 제8조')[0];
 assert.equal(m.status,'current');assert.ok(m.articleText.includes('보증금 중 일정액'));
 for(const n of ['10','11'])assert.ok(m.related.some(r=>r.lawId==='housing-decree'&&r.article===n));
 assert.ok(!m.related.some(r=>r.lawId==='housing-decree'&&r.article==='33'));
 const d=getLegalMentionDetails(m);assert.ok(d.verifiedOn);assert.equal(d.article.text,m.articleText);
});
test('same-law implementing decree changes the instrument, and repeated articles retain their named law',()=>{
 const r=getLegalMentions('주택임대차보호법 제8조 제1항·제3항; 같은 법 시행령 제10조·제11조');
 assert.deepEqual(r.slice(-2).map(m=>[m.lawId,m.article]),[['housing-decree','10'],['housing-decree','11']]);
 const repeated=getLegalMentions('민사집행법 제102조는 남을 가망을 심사한다. 제102조는 경매의 취소를 정한다.','P1023');
 assert.ok(repeated.every(m=>m.lawId==='civil-execution'));
});
test('current references in audited edge-case fixtures retain official text after pruning',()=>{
 let current=0;
 for(const r of corpus)for(const m of getLegalMentions(r.text,r.contextId)){
  assert.notEqual(m.status,'unresolved',r.contextId+' '+m.label);
  if(m.status==='current'){current++;assert.ok(m.articleText,r.contextId+' '+m.lawId+' '+m.article);}
  else assert.equal(m.articleText,undefined);
 }
 assert.ok(current>20);
});
test('supplementary law history stays separate from main provisions; mixed practice note retains DRBA 619',()=>{
 const note=corpus.find(r=>r.contextId==='fn-033');
 const m=getLegalMentions(note.text,note.contextId);
 assert.deepEqual(m.filter(x=>x.status==='historical').map(x=>x.article),['부칙:2','부칙:4','부칙:2','부칙:6']);
 const practice=corpus.find(r=>r.contextId==='fn-243');
 assert.deepEqual(getLegalMentions(practice.text,practice.contextId).map(x=>[x.article,x.lawId]),[['619','drba']]);
});
test('amendment self-references and proposed supplementary headings retain the audited owner',()=>{
 const amendment=corpus.find(r=>r.contextId==='P1136');
 const a=getLegalMentions(amendment.text,amendment.contextId);
 assert.equal(a.find(x=>x.start===784).article,'600-2');
 assert.equal(a.find(x=>x.start===1798).article,'600-2');
 const supplementary=corpus.find(r=>r.contextId==='P1188');
 const s=getLegalMentions(supplementary.text,supplementary.contextId);
 assert.deepEqual(s.filter(x=>/^제[1-5]조$/.test(x.label)).map(x=>[x.article,x.status]),['1','2','3','4','5'].map(n=>['부칙:'+n,'proposal']));
 assert.equal(s.find(x=>x.label==='제1항').article,'부칙:2');
});
test('relative-article title includes its owner and future implementing provisions are excluded',()=>{
 assert.equal(getLegalMentionDetails(getLegalMentions('주택임대차보호법 제8조 제1항 및 제3항')[1]).title,'주택임대차보호법 제8조 제3항');
 assert.ok(!getLegalLaw('victim-support-decree').articleNumbers.includes('4-4'));
});
test('German-law neighbor and revision explanation keep their foreign jurisdiction',()=>{
 for(const id of ['P1056','proposal:P1055:reason']){
  const r=corpus.find(x=>x.contextId===id),m=getLegalMentions(r.text,id);
  assert.ok(m.length);assert.ok(m.every(x=>x.lawId==='de-insolvency'&&x.status==='foreign'));
 }
 const note=corpus.find(x=>x.contextId==='fn-063');
 const relative=getLegalMentions(note.text,note.contextId).find(x=>x.label==='같은 조 제5항');
 assert.deepEqual([relative.lawId,relative.article,relative.paragraph],['housing','3-3','5']);
});

test('Ponoroff and Bork source explanations use US and German statutes, independently of the surrounding Korean footnote default',()=>{
 const examples=[['fn-225','s-afdd9b909aa984fb','us-bankruptcy',['1306','1327','1306','1327']],['fn-226','s-92ee28b9ae50b4f6','de-insolvency',['165']]];
 for(const [note,source,law,articles] of examples){
  const mentions=getLegalMentions(explanations[note][source],`citation-explanation:${note}:${source}`);
  assert.deepEqual(mentions.map(x=>x.article),articles);assert.ok(mentions.every(x=>x.lawId===law&&x.status==='foreign'&&x.articleText===undefined));
  for(const mention of mentions){assert.ok(!mention.href.includes('law.go.kr'));if(law==='us-bankruptcy'){assert.match(mention.href,new RegExp('section'+mention.article));assert.ok(mention.related.some(x=>x.href.includes('USCODE-2024-title11')&&x.href.endsWith('-sec'+mention.article+'.htm')));}else assert.equal(mention.href,'https://www.gesetze-im-internet.de/inso/__165.html');}
 }
});

test('source explanation scope does not leak into manuscript text or survive replacement text',()=>{
 assert.equal(getLegalMentions('제165조','fn-226')[0].lawId,'drba');
 assert.equal(getLegalMentions('독일 도산법 제165조','fn-226')[0].lawId,'de-insolvency');
 const context='citation-explanation:fn-225:s-afdd9b909aa984fb';
 const unknown=getLegalMentions('제1306조에 관한 새 설명',context)[0];assert.equal(unknown.status,'unresolved');assert.equal(unknown.lawId,undefined);
 assert.equal(getLegalMentions('민법 제165조',context)[0].lawId,'civil');
 assert.notEqual(getLegalMentions(explanations['fn-225']['s-afdd9b909aa984fb'],'citation-explanation:fn-225:other-source')[0].lawId,'us-bankruptcy');
});

test('all 374 existing source explanations retain their article targets except the five reviewed foreign targets',()=>{
 let rows=0,mentions=0;const changed=[];
 for(const [note,refs] of Object.entries(explanations))for(const [source,text] of Object.entries(refs)){
  rows++;const before=getLegalMentions(text,note),after=getLegalMentions(text,`citation-explanation:${note}:${source}`);mentions+=after.length;
  if(note==='fn-225'&&source==='s-afdd9b909aa984fb'||note==='fn-226'&&source==='s-92ee28b9ae50b4f6'){changed.push([note,after.length]);continue;}
  assert.deepEqual(after,before,note+':'+source);
 }
 assert.equal(rows,374);assert.equal(mentions,80);assert.deepEqual(changed,[['fn-225',4],['fn-226',1]]);
});
