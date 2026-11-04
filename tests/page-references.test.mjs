import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pageReferences} from '../src/page-references.ts';

const manifest=JSON.parse(readFileSync(new URL('../public/editions/human80/manifest.json',import.meta.url),'utf8'));
const catalog=new Map(manifest.sources.map(source=>[source.id,source]));
const refs=page=>pageReferences(manifest.notes,catalog,page);

test('initial and following manuscript pages resolve to their own citations in reading order',()=>{
 assert.deepEqual([20,21,22].map(page=>refs(page)[0].number),[1,3,7]);
 assert.equal(refs(20)[0].title,'주택임대차에서 존속보장과 차임규제 법제연구');
 assert.equal(refs(20)[0].page,27);
 assert.equal(refs(20)[1].number,2);
 assert.deepEqual(refs(31),[]);
});

test('a missing source does not hide a later linked note, and shared sources keep distinct note contexts',()=>{
 const source={id:'book',title:'source'};
 const notes=['missing','book','book'].map((sourceId,i)=>({id:'n'+i,number:i+1,page:4,sourceRefs:[{sourceId,targetPage:i+1}]}));
 assert.deepEqual(pageReferences(notes,new Map([[source.id,source]]),4).map(ref=>[ref.key,ref.page]),[['n1/book',2],['n2/book',3]]);
});
