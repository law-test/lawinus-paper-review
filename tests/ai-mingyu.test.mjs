import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evidenceHref,MINGYU_ENDPOINT} from '../src/ai-mingyu-client.ts';
import {reviewDeepLink,proposalAnnotation} from '../src/thesis-faq-model.ts';
import {defaultReadingSession,validateReadingSession} from '../src/reading-session.ts';

test('private service points to loopback and evidence rejects executable schemes and embedded credentials',()=>{
 assert.equal(MINGYU_ENDPOINT,'http://127.0.0.1:43164');
 for(const value of ['javascript:alert(1)','data:text/html,test','file:///C:/auth.json','http://example.org','https://secret:password@example.org'])assert.equal(evidenceHref(value),null);
 assert.equal(evidenceHref('./?proposal=P1134'),'https://paper.lawinus.org/?proposal=P1134');
 assert.equal(evidenceHref('https://www.law.go.kr/법령/민법'),'https://www.law.go.kr/%EB%B2%95%EB%A0%B9/%EB%AF%BC%EB%B2%95');
});
test('thesis and footnote links only accept IDs present in the loaded edition',()=>{
 const args=[['P1134'],['fn-001'],['P0385']];
 assert.deepEqual(reviewDeepLink('?view=ai-mingyu',...args),{view:'ai-mingyu'});
 assert.deepEqual(reviewDeepLink('?note=fn-001',...args),{view:'note',id:'fn-001'});
 assert.deepEqual(reviewDeepLink('?paragraph=P0385',...args),{view:'paragraph',id:'P0385'});
 assert.equal(reviewDeepLink('?note=fn-999',...args),null);
 assert.equal(reviewDeepLink('?paragraph=P9999',...args),null);
 assert.deepEqual(reviewDeepLink('?proposal=P1134&note=fn-001',...args),{view:'proposal',id:'P1134'});
});
test('private panel restoration leaves the document positions unchanged and does not contain account credentials',()=>{
 const catalog={pageCount:279,sources:[{id:'a',pages:220}],noteIds:['fn-001'],paragraphIds:['P0385'],proposalIds:['P1134'],defaultSourceId:'a'};
 const state={...defaultReadingSession('paper',catalog),tab:'ai-mingyu',mobilePane:'metadata',thesis:{page:249,zoom:1.3},sources:{a:{page:199,zoom:1.45}}};
 assert.deepEqual(validateReadingSession({...state,token:'must-never-be-stored'},'paper',catalog),state);
});

test('revision footnote links cannot silently point to a same-number footnote in the older review edition',()=>{
 const proposal={id:'P0939',after:'본문 참조〔각주 209〕\n\n〔각주 209〕 전대규, 2180~2181면.\n\n〔각주 210〕 별도 문헌.'};
 assert.deepEqual(proposalAnnotation('?proposal=P0939&annotation=209',proposal),{number:'209',text:'〔각주 209〕 전대규, 2180~2181면.'});
 assert.equal(proposalAnnotation('?proposal=P0942&annotation=209',proposal),null);
 assert.equal(proposalAnnotation('?proposal=P0939&annotation=208',proposal),null);
 assert.equal(proposalAnnotation('?proposal=P0939&annotation=209%7C210',proposal),null);
});
