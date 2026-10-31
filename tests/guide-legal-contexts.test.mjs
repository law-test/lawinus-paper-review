import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getLegalMentions} from '../src/legal-link-model.ts';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const items=read('../src/revision-proposals.json').items,release=read('./fixtures/edition-release286.json');
const mentions=(item,field,edition='human80')=>getLegalMentions(item[field],{contextId:`proposal:${item.id}:${field}`,edition});
test('all approved guide fields use their source-edition scope regardless of the active reader',()=>{
 let count=0;
 for(const item of items)for(const field of ['before','after','reason']){
  const a=mentions(item,field),b=mentions(item,field,'v127');assert.deepEqual(a,b,item.id+':'+field);count+=a.length;
  for(const m of a){assert.notEqual(m.status,'unresolved',item.id+':'+field+' '+m.label);if(m.status!=='current')assert.equal(m.articleText,undefined);}
 }
 assert.equal(items.length*3,release.guide.fields);assert.ok(count>0);
});
test('foreign guide citations retain their own official jurisdiction and never imply current Korean text',()=>{
 const foreign=items.flatMap(item=>['before','after','reason'].flatMap(field=>mentions(item,field).filter(m=>m.status==='foreign')));
 assert.ok(foreign.length>0);
 for(const m of foreign){assert.ok(m.lawId);assert.equal(m.articleText,undefined);assert.match(new URL(m.href).hostname,/(?:gesetze-im-internet\.de|uscode\.house\.gov|laws\.e-gov\.go\.jp)$/);}
});
test('quoted commentary article-number titles remain bibliography rather than statute dialogs',()=>{
 let titles=0;
 for(const item of items)for(const field of ['before','after','reason']){
  const all=mentions(item,field);
  for(const title of item[field].matchAll(/「제\d+조(?:의\d+)?」/g)){
   titles++;const start=title.index,end=start+title[0].length;
   assert.ok(!all.some(m=>m.start<end&&m.end>start),item.id+':'+field+' '+title[0]);
  }
 }
 assert.ok(titles>0);
});
