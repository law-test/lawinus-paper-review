import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultReadingSession,readReadingSession,validateReadingSession,saveReadingSession,readingSessionKey,sourceReadingPosition} from '../src/reading-session.ts';
const catalog={pageCount:279,sources:[{id:'a',pages:220},{id:'b',pages:48}],noteIds:['fn-001','fn-210'],paragraphIds:['P0283'],proposalIds:['P0283','FN1'],defaultSourceId:'a',defaultSourcePage:27};
function storage(){const values=new Map(),writes=[];return {values,writes,getItem:key=>values.get(key)||null,setItem:(key,value)=>{writes.push({key,value});values.set(key,value);}};}
test('first-time human80 and v120 readers open their distinct body starts without overriding saved pages',()=>{
 for(const [datasetId,start] of [['human-1029-1629',20],['applied-v120-human80',19]]){
  const local=storage(),editionCatalog={...catalog,defaultThesisPage:start};
  assert.equal(readReadingSession(local,datasetId,editionCatalog).session.thesis.page,start);
  saveReadingSession(local,{...defaultReadingSession(datasetId,editionCatalog),thesis:{page:77,zoom:1}});
  assert.equal(readReadingSession(local,datasetId,editionCatalog).session.thesis.page,77);
 }
});
test('a new reader keeps existing defaults and does not write before a valid dataset has loaded',()=>{
 const local=storage(),result=readReadingSession(local,'human-a',catalog);
 assert.equal(result.restored,false);assert.equal(result.session.thesis.page,20);assert.equal(result.session.thesis.zoom,1);
 assert.equal(result.session.sourceId,'a');assert.equal(result.session.sources.a.page,27);assert.equal(local.writes.length,0);
});

test('per-document fit modes survive reload and reference switches while old numeric-only sessions remain numeric',()=>{
 const local=storage(),session={...defaultReadingSession('human-a',catalog),thesis:{page:249,zoom:.38,fitMode:'page'},sources:{a:{page:29,zoom:1,fitMode:'width'},b:{page:21,zoom:1.45}}};
 saveReadingSession(local,session);const restored=readReadingSession(local,'human-a',catalog).session;assert.deepEqual(restored,session);
 assert.deepEqual(sourceReadingPosition(restored.sources,'a',220,1,33),{page:33,zoom:1,fitMode:'width'});assert.equal(sourceReadingPosition(restored.sources,'b',48).fitMode,undefined);
 const invalid=validateReadingSession({...session,thesis:{page:249,zoom:.2,fitMode:'unknown'}},'human-a',catalog);assert.deepEqual(invalid.thesis,{page:249,zoom:.7});
});
test('reload restores both documents with independent page and zoom plus active note and selected view',()=>{
 const local=storage(),session={...defaultReadingSession('human-a',catalog),thesis:{page:249,zoom:1.15},sources:{a:{page:199,zoom:1.3},b:{page:21,zoom:1.6}},sourceId:'b',activeNote:'fn-210',manuscriptMode:'body',mobilePane:'source',tab:'revision',paragraphId:'P0283',proposalId:'P0283'};
 assert.equal(saveReadingSession(local,session),true);const result=readReadingSession(local,'human-a',catalog);
 assert.equal(result.restored,true);assert.deepEqual(result.session,session);
});
test('an unavailable citation remains unselected after reload without losing either saved document position',()=>{
 const local=storage(),session={...defaultReadingSession('human-a',catalog),thesis:{page:249,zoom:.38,fitMode:'page'},sources:{a:{page:199,zoom:1.3},b:{page:21,zoom:1.6}},sourceId:'',activeNote:'fn-210',mobilePane:'metadata',tab:'source'};
 saveReadingSession(local,session);
 const restored=readReadingSession(local,'human-a',catalog);
 assert.equal(restored.restored,true);assert.deepEqual(restored.session,session);
 saveReadingSession(local,restored.session);
 assert.deepEqual(readReadingSession(local,'human-a',catalog).session,session);
 assert.deepEqual(sourceReadingPosition(restored.session.sources,'a',220),{page:199,zoom:1.3});
});
test('a missing or unknown source identity still uses the existing default while a valid old session is unchanged',()=>{
 const base={...defaultReadingSession('human-a',catalog),activeNote:'fn-210',sourceId:'b',sources:{a:{page:27,zoom:1},b:{page:21,zoom:1.6}}};
 assert.deepEqual(validateReadingSession(base,'human-a',catalog),base);
 for(const sourceId of ['removed',null,undefined]){
  const old={...base,sourceId};if(sourceId===undefined)delete old.sourceId;
  const restored=validateReadingSession(old,'human-a',catalog);
  assert.equal(restored.sourceId,'a');assert.equal(restored.activeNote,'fn-210');
  assert.deepEqual(restored.sources,base.sources);
 }
});
test('datasets do not share reading positions and a mismatched stored dataset is rejected',()=>{
 const local=storage(),session={...defaultReadingSession('human-a',catalog),thesis:{page:249,zoom:1.15}};saveReadingSession(local,session);
 assert.equal(readReadingSession(local,'human-b',catalog).session.thesis.page,20);
 local.values.set(readingSessionKey('human-b'),JSON.stringify(session));assert.equal(readReadingSession(local,'human-b',catalog).restored,false);
});
test('stale identities and unsafe page/zoom values are validated against the loaded catalog',()=>{
 const raw={...defaultReadingSession('human-a',catalog),thesis:{page:9999,zoom:99},sources:{a:{page:-10,zoom:.1},b:{page:NaN,zoom:Infinity},removed:{page:20,zoom:1}},sourceId:'removed',activeNote:'fn-999',paragraphId:'P9999',proposalId:'invented',mobilePane:'unknown',manuscriptMode:'unknown',tab:'unknown'};
 const result=validateReadingSession(raw,'human-a',catalog);
 assert.deepEqual(result.thesis,{page:279,zoom:2});assert.deepEqual(result.sources.a,{page:1,zoom:.7});assert.deepEqual(result.sources.b,{page:1,zoom:1});
 assert.equal(result.sources.removed,undefined);assert.equal(result.activeNote,'fn-001');assert.equal(result.sourceId,'a');assert.equal(result.manuscriptMode,'pdf');assert.equal(result.mobilePane,'thesis');assert.equal(result.paragraphId,'');assert.equal(result.proposalId,'');
});
test('broken or blocked local storage leaves documents readable without altering saved records',()=>{
 const local=storage();local.values.set(readingSessionKey('human-a'),'{broken');assert.equal(readReadingSession(local,'human-a',catalog).restored,false);assert.equal(local.writes.length,0);
 local.values.set(readingSessionKey('human-a'),' '.repeat(256*1024+1));assert.equal(readReadingSession(local,'human-a',catalog).restored,false);
 const blocked={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('quota');}};
 assert.equal(readReadingSession(blocked,'human-a',catalog).session.thesis.page,20);assert.equal(saveReadingSession(blocked,defaultReadingSession('human-a',catalog)),false);
});
test('switching references resumes each document while an explicit citation page overrides its remembered page',()=>{
 const saved={a:{page:199,zoom:1.3},b:{page:21,zoom:1.6}};
 assert.deepEqual(sourceReadingPosition(saved,'a',220,27),{page:199,zoom:1.3});
 assert.deepEqual(sourceReadingPosition(saved,'b',48,18),{page:21,zoom:1.6});
 assert.deepEqual(sourceReadingPosition(saved,'a',220,27,27),{page:27,zoom:1.3});
 assert.deepEqual(sourceReadingPosition(saved,'new',30,12),{page:12,zoom:1});
 assert.deepEqual(saved,{a:{page:199,zoom:1.3},b:{page:21,zoom:1.6}});
});


test('a supplemental text original restores only for its verified active footnote and registry kind',()=>{
 const enriched={...catalog,textTranslations:[{sourceId:'de',kind:'text',noteIds:['fn-210']},{sourceId:'en',kind:'pdf',noteIds:['fn-210']}]};
 const base={...defaultReadingSession('human-a',enriched),activeNote:'fn-210',textTranslation:'de',mobilePane:'source'};
 assert.equal(validateReadingSession(base,'human-a',enriched).textTranslation,'de');
 assert.equal(validateReadingSession({...base,activeNote:'fn-001'},'human-a',enriched).textTranslation,'');
 assert.equal(validateReadingSession({...base,textTranslation:'en'},'human-a',enriched).textTranslation,'');
 assert.equal(validateReadingSession({...base,textTranslation:'missing'},'human-a',enriched).textTranslation,'');
 const old={...base};delete old.textTranslation;assert.equal(validateReadingSession(old,'human-a',enriched).textTranslation,'');
});
