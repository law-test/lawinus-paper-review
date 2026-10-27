import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getLegalMentions} from '../src/legal-link-model.ts';
const items=JSON.parse(readFileSync(new URL('../src/revision-proposals.json',import.meta.url),'utf8')).items;
const mentions=(id,field,edition='human73')=>{const item=items.find(row=>row.id===id);return getLegalMentions(item[field],{contextId:`proposal:${id}:${field}`,edition});};
test('all 492 completed guide fields use the same source edition context regardless of the active reader',()=>{
 let count=0;
 for(const item of items)for(const field of ['before','after','reason']){
  const a=mentions(item.id,field),b=mentions(item.id,field,'v110');assert.deepEqual(a,b,item.id+':'+field);count+=a.length;
  for(const m of a){assert.notEqual(m.status,'unresolved',item.id+':'+field+' '+m.label);if(m.status!=='current')assert.equal(m.articleText,undefined);}
 }
 assert.ok(count>350);
});
test('reviewed mixed-law reasons retain the special-act provision and enforcement procedure provisions',()=>{
 for(const id of ['H73-P1073','H73-P1296'])assert.equal(mentions(id,'reason').find(m=>m.article==='25-13').lawId,'victim-support');
 for(const article of ['154','155'])assert.equal(mentions('H73-P0608','reason').find(m=>m.article===article).lawId,'civil-execution');
 assert.equal(mentions('H73-P0061','reason').find(m=>m.article==='415').lawId,'drba');
 for(const field of ['before','after'])assert.equal(mentions('TOC107-01',field).find(m=>m.article==='141').lawId,'drba');
});
test('commentary chapter titles in the guide do not open statute dialogs',()=>{
 assert.equal(mentions('FN73-027','before').filter(m=>['589','600'].includes(m.article)).length,0);
 for(const id of ['H73-P1309','H73-P1333','H73-P1385','H73-P1394'])assert.equal(mentions(id,'reason').filter(m=>m.article==='615').length,0);
});
