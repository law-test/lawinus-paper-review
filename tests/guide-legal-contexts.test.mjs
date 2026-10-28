import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getLegalMentions} from '../src/legal-link-model.ts';
const items=JSON.parse(readFileSync(new URL('../src/revision-proposals.json',import.meta.url),'utf8')).items;
const mentions=(id,field,edition='human77')=>{const item=items.find(row=>row.id===id);return getLegalMentions(item[field],{contextId:`proposal:${id}:${field}`,edition});};
test('all 360 completed guide fields use the same source edition context regardless of the active reader',()=>{
 let count=0;
 for(const item of items)for(const field of ['before','after','reason']){
  const a=mentions(item.id,field),b=mentions(item.id,field,'v112');assert.deepEqual(a,b,item.id+':'+field);count+=a.length;
  for(const m of a){assert.notEqual(m.status,'unresolved',item.id+':'+field+' '+m.label);if(m.status!=='current')assert.equal(m.articleText,undefined);}
 }
 assert.equal(items.length*3,360);assert.equal(count,155);
});
test('reviewed mixed-law and foreign guide reasons retain their actual jurisdiction',()=>{
 assert.equal(mentions('F112-13','reason').find(m=>m.article==='102').lawId,'civil-execution');
 assert.equal(mentions('E112-20','reason').find(m=>m.article==='30d').lawId,'de-execution');
 assert.equal(mentions('E112-20','reason').find(m=>m.article==='30d').status,'foreign');
 assert.equal(mentions('TOC77-01','before').find(m=>m.article==='141').lawId,'drba');
 assert.deepEqual(mentions('TOC77-01','after'),[]); // After is an instruction to regenerate the TOC, not a copied list of headings.
});
test('reviewed commentary titles and described source typos do not open statute dialogs',()=>{
 for(const id of ['F112-R170','E112-22','E112-23','BOOK77-02-B','E112-BONJU148','E112-BONJU160'])assert.deepEqual(mentions(id,'reason'),[]);
 assert.equal(mentions('E112-22','after').filter(m=>m.article==='160').length,0);
 assert.ok(mentions('E112-22','after').some(m=>m.article==='600'&&m.lawId==='drba'));
});
