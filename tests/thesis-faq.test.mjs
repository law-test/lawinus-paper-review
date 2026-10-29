import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterFaq,reviewDeepLink} from '../src/thesis-faq-model.ts';
import {defaultReadingSession,validateReadingSession} from '../src/reading-session.ts';
import {getLegalMentions} from '../src/legal-link-model.ts';

const read=name=>JSON.parse(readFileSync(new URL(`../src/${name}.json`,import.meta.url),'utf8'));
const proposals=read('revision-proposals').items;
const faq=read('thesis-faq').items;
const ids=proposals.map(item=>item.id);

test('every published FAQ has an answer, unique stable ID and usable evidence links',()=>{
 assert.equal(faq.length,300);assert.equal(new Set(faq.map(item=>item.id)).size,faq.length);
 assert.equal(faq.filter(item=>item.id.startsWith('committee-')).length,100);
 for(const item of faq){
  assert.match(item.id,/^(?:faq-[a-z0-9-]+|committee-(?:kim|lee|gyuwan|cheon|hwang)-\d{2})$/);
  assert.ok(item.question.trim()&&item.category.trim()&&item.answer.length&&item.answer.every(p=>p.trim()));
  assert.ok(item.sources.length,`No evidence: ${item.id}`);
  for(const source of item.sources){
   assert.ok(source.label.trim());
   const url=new URL(source.href,'https://paper.lawinus.org/');
   assert.equal(url.protocol,'https:');assert.equal(url.username,'');assert.equal(url.password,'');
   if(url.origin==='https://paper.lawinus.org'&&url.searchParams.has('proposal')){
    assert.ok(ids.includes(url.searchParams.get('proposal')),`${item.id}: unknown proposal`);
    assert.match(source.label,/수정안|논문 v104 문안/);
   }
   assert.ok(!source.href.includes('C:/')&&!source.href.includes('file:'));
  }
 }
});

test('the replacement examiner has twenty explicitly labelled practice questions tied to human80 and official research',()=>{
 const research=read('reviewer-research');
 const catalog=new Set(read('paragraph-catalog').paragraphs.map(p=>p.id));
 const questions=faq.filter(item=>item.id.startsWith('committee-gyuwan-'));
 assert.equal(questions.length,20);assert.equal(faq.some(item=>item.id.startsWith('committee-choi-')),false);
 assert.equal(research.works.length,28);assert.equal(research.books.length,7);
 assert.equal(research.works.filter(work=>work.year===2026).length,3);
 const sourceUrls=new Set(research.sources.map(source=>source.url));
 for(const item of questions){
  assert.equal(item.answerLabel,'답변 준비');assert.match(item.status,/예상 질문/);assert.match(item.status,/실제.*아님/);assert.ok(item.followup.trim());
  assert.ok(item.sources.some(source=>sourceUrls.has(source.href)),item.id);
  const manuscriptSources=item.sources.filter(source=>source.href.startsWith('./?edition=human80&paragraph='));
  assert.ok(manuscriptSources.length,item.id);
  for(const source of manuscriptSources)assert.ok(catalog.has(new URL(source.href,'https://paper.lawinus.org/').searchParams.get('paragraph')),item.id);
 }
});

test('a valid proposal link opens the exact current proposal while an unknown ID is ignored',()=>{
 assert.deepEqual(reviewDeepLink('?proposal='+ids[0],ids),{view:'proposal',id:ids[0]});
 assert.deepEqual(reviewDeepLink('?proposal='+ids[1]+'&view=faq',ids),{view:'proposal',id:ids[1]});
 assert.equal(reviewDeepLink('?proposal=P999999',ids),null);
 assert.equal(reviewDeepLink('?proposal=https%3A%2F%2Fexample.com',ids),null);
 assert.deepEqual(reviewDeepLink('?view=faq&v=faq262',ids),{view:'faq'});
 assert.equal(reviewDeepLink('?view=anything-else',ids),null);
 assert.equal(reviewDeepLink('',ids),null);
});

test('the new examiner preparation routes jeonse-right provisions to civil law and the two insolvency conditions to DRBA',()=>{
 for(const [id,lawId,articles] of [['committee-gyuwan-04','civil',['303','318']],['committee-gyuwan-02','drba',['615','600']]]){
  const item=faq.find(row=>row.id===id);
  const mentions=item.answer.flatMap(text=>getLegalMentions(text,{contextId:'faq:'+item.id,defaultLawId:item.defaultLawId,edition:'human80'}));
  assert.deepEqual(mentions.map(m=>m.article),articles);assert.ok(mentions.every(m=>m.lawId===lawId&&m.status==='current'));
 }
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
