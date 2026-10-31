import test from 'node:test';
import assert from 'node:assert/strict';
import {getLegalMentions} from '../src/legal-link-model.ts';

test('old and new commentary chapter typography open the source, not a statute',()=>{
 for(const [a,b] of [['「','」'],['“','”'],['"','"']]){
  const text=`김범준, ${a}제615조${b}, 『주석 채무자회생법 (Ⅴ)』, 604-605면. 채무자회생법 제615조 제2항을 검토한다.`;
  const mentions=getLegalMentions(text,{edition:'v126',contextId:'note:fn-352'});
  assert.deepEqual(mentions.map(m=>m.label),['제615조 제2항']);
  assert.equal(mentions[0].lawId,'drba');
  assert.equal(text.slice(mentions[0].start,mentions[0].end),'제615조 제2항');
 }
});
test('new quote marks do not turn a guide bibliography title into a statute target',()=>{
 const result=getLegalMentions('“제589조”의 출전을 보완한다. 채무자회생법 제600조 제1항은 별도이다.',{edition:'v126',contextId:'proposal:format286:after'});
 assert.deepEqual(result.map(m=>m.article),['600']);
});
test('explicitly quoted statute and historical status survive changed typography',()=>{
 assert.equal(getLegalMentions('“주택임대차보호법” 제3조',{edition:'v126'})[0].lawId,'housing');
 assert.equal(getLegalMentions('구 “신탁법” 제21조',{edition:'v126'})[0].status,'historical');
});
