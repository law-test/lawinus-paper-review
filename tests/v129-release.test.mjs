import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getLegalMentions} from '../src/legal-link-model.ts';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const m=read('../public/editions/v129/manifest.json');
const catalog=read('../src/paragraph-catalog-v129.json').paragraphs;
test('v129 uses the latest full-document 10 percent limits and separates prior AI results',()=>{
 assert.equal(m.pageLimit.maximum,218);assert.ok(m.physicalPages<=218);
 assert.equal(m.lengthMetrics.wholeCharacterCap,152676);assert.ok(m.lengthMetrics.wholeCharactersAfter<=152676);
 assert.equal(m.inspectionRecord.appliedV126Tested,true);assert.equal(m.inspectionRecord.appliedV129Tested,false);assert.equal(m.inspectionRecord.fivePercentTargetVerified,false);
 assert.deepEqual(m.inspectionRecord.providedV126Reports.map(r=>r.ai_percent).sort((a,b)=>a-b),[10,30]);
});
test('domestic references inside US comparison and relative paragraph references retain exact jurisdiction',()=>{
 for(const[id,label,article]of[['P0891','제615조 제2항','615'],['P0891','제600조','600'],['P0760','제1항','600'],['P0806','제4항','580'],['P0761','제600조 제2항','600']]){
  const text=catalog.find(p=>p.id===id).text;const a=getLegalMentions(text,{edition:'v129',contextId:id}).find(q=>q.label===label);
  assert.ok(a,id+label);assert.equal(a.lawId,'drba');assert.equal(a.article,article);assert.equal(a.status,'current');
 }
 const us=getLegalMentions(catalog.find(p=>p.id==='P0891').text,{edition:'v129',contextId:'P0891'}).filter(x=>['1306','1327','362'].includes(x.article));
 assert.equal(us.length,3);for(const x of us)assert.equal(x.lawId,'us-bankruptcy');
});
