import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterFaq,reviewDeepLink} from '../src/thesis-faq-model.ts';
import {defaultReadingSession,validateReadingSession} from '../src/reading-session.ts';

const read=name=>JSON.parse(readFileSync(new URL(`../src/${name}.json`,import.meta.url),'utf8'));
const proposals=read('revision-proposals').items;
const faq=read('thesis-faq').items;
const ids=proposals.map(item=>item.id);

test('every published FAQ has an answer, unique stable ID and usable evidence links',()=>{
 assert.ok(faq.length>0);assert.equal(new Set(faq.map(item=>item.id)).size,faq.length);
 for(const item of faq){
  assert.match(item.id,/^faq-[a-z0-9-]+$/);
  assert.ok(item.question.trim()&&item.category.trim()&&item.answer.length&&item.answer.every(p=>p.trim()));
  assert.ok(item.sources.length,`No evidence: ${item.id}`);
  for(const source of item.sources){
   assert.ok(source.label.trim());
   const url=new URL(source.href,'https://paper.lawinus.org/');
   assert.equal(url.protocol,'https:');assert.equal(url.username,'');assert.equal(url.password,'');
   if(url.origin==='https://paper.lawinus.org'&&url.searchParams.has('proposal')){
    assert.ok(ids.includes(url.searchParams.get('proposal')),`${item.id}: unknown proposal`);
    assert.match(source.label,/수정안/);
   }
   assert.ok(!source.href.includes('C:/')&&!source.href.includes('file:'));
  }
 }
});

test('a valid proposal link opens the exact current proposal while an unknown ID is ignored',()=>{
 assert.deepEqual(reviewDeepLink('?proposal=P0324',ids),{view:'proposal',id:'P0324'});
 assert.deepEqual(reviewDeepLink('?proposal=P1134&view=faq',ids),{view:'proposal',id:'P1134'});
 assert.equal(reviewDeepLink('?proposal=P999999',ids),null);
 assert.equal(reviewDeepLink('?proposal=https%3A%2F%2Fexample.com',ids),null);
 assert.deepEqual(reviewDeepLink('?view=faq&v=faq262',ids),{view:'faq'});
 assert.equal(reviewDeepLink('?view=anything-else',ids),null);
 assert.equal(reviewDeepLink('',ids),null);
});

test('FAQ restoration preserves independent document positions, sources and saved reading surfaces',()=>{
 const catalog={pageCount:279,sources:[{id:'a',pages:220}],noteIds:['fn-001'],paragraphIds:['P0283'],proposalIds:ids,defaultSourceId:'a'};
 const stored={...defaultReadingSession('paper',catalog),tab:'faq',mobilePane:'metadata',thesis:{page:249,zoom:1.3},sources:{a:{page:199,zoom:1.45}},readingView:{focus:true,header:false,tools:false,footnotes:true,focusSurfaces:{metadata:true,sidebar:false}}};
 assert.deepEqual(validateReadingSession(stored,'paper',catalog),stored);
});

test('search matches answers and source labels, requires all search words and leaves content untouched',()=>{
 const sample=[{id:'faq-one',category:'입법제안',question:'절차를 보전하는 방법은?',answer:['인가 전 적법한 대금 완납이 필요하다.'],sources:[{label:'제615조 · 논문 수정안',href:'./?proposal=P1134'}]},
 {id:'faq-two',category:'연구방법',question:'연구의 한계는?',answer:['총비용 비교표본이 없다.'],sources:[{label:'논문 수정안',href:'./?proposal=P0324'}]}];
 const before=JSON.stringify(sample);
 assert.deepEqual(filterFaq(sample,'  적법한   완납 ').map(x=>x.id),['faq-one']);
 assert.deepEqual(filterFaq(sample,'615조').map(x=>x.id),['faq-one']);
 assert.deepEqual(filterFaq(sample,'총비용 완납'),[]);
 assert.deepEqual(filterFaq(sample,'   '),sample);
 assert.equal(JSON.stringify(sample),before);
});
