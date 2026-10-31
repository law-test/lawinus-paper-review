import test from 'node:test';
import assert from 'node:assert/strict';
import {getLegalMentions,getLegalMentionDetails,getLegalLaw} from '../src/legal-link-model.ts';

test('May 2026 immediately effective support articles use their verified source, not the stale later-sequence response',()=>{
 const text='전세사기피해자법 제20조 및 제25조, 제25조의2, 제25조의3, 제25조의13을 적용한다.';
 const mentions=getLegalMentions(text,{edition:'v126'});
 assert.deepEqual(mentions.map(m=>m.article),['20','25','25-2','25-3','25-13']);
 for(const m of mentions){
  assert.equal(m.status,'current');
  assert.ok(m.href.includes('lsiSeq=285963'));
  const detail=getLegalMentionDetails(m);
  assert.ok(detail.effectiveLabel.includes('2026. 5. 12.'));
  assert.ok(detail.relatedNote.includes('제25조의8부터 제25조의12까지'));
 }
 assert.ok(mentions[0].articleText.includes('최고매수신고가격이 없는 경우'));
 assert.ok(mentions[1].articleText.includes('⑮'));
 assert.ok(mentions[1].articleText.includes('권리를 행사할 수 있다'));
 assert.ok(!mentions[1].articleText.includes('양도한 것으로 간주한다'));
 assert.ok(mentions[3].articleText.includes('우선적으로 협의하여야 한다'));
 assert.ok(mentions[4].articleText.includes('우선변제권이 인정되는 한도 내'));
});

test('delayed minimum-guarantee articles are not offered as current law on October 31',()=>{
 const law=getLegalLaw('victim-support');
 for(const id of ['25-9','25-10','25-11','25-12']){
  assert.ok(!law.articleNumbers.includes(id));assert.equal(law.articles[id],undefined);
 }
});

import citations from '../src/citation-links-v127.json' with {type:'json'};
test('final FN102 exposes current article 25 and exact 2026 amendment supplementary provisions',()=>{
 const text=citations.notes['fn-102'].text;
 const mentions=getLegalMentions(text,{edition:'v127',contextId:'fn-102'});
 const current=mentions.filter(m=>m.status==='current');
 assert.deepEqual(current.map(m=>m.article),['25','25-2','25-3','25','25','25','25']);
 assert.ok(current.every(m=>m.href.includes('lsiSeq=285963')));
 const supplementary=mentions.filter(m=>m.status==='historical');assert.equal(supplementary.length,2);
 assert.ok(supplementary.every(m=>m.href.includes('lsRvsDocListP.do')&&m.articleText===undefined));
 assert.ok(!mentions.some(m=>['25-8','25-12'].includes(m.article)));
});
