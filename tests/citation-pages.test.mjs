import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {citedSourceRefs, citedPages, citationStartPage, citationHighlights, citedTextParts, citedPageLabel} from '../src/citation-model.ts';

const map = JSON.parse(readFileSync(new URL('./fixtures/legacy1021/citation-pages.json', import.meta.url), 'utf8'));

test('each citation uses its own pages rather than all locators of the same work', () => {
  const entry = map['fn-001']['s-ead27940ae5e0e78'];
  assert.deepEqual(citedPages(entry, 220).map(p => p.page), [27, 28, 29, 30, 197, 199]);
  assert.deepEqual(citedPages(entry, 220).map(p => p.printed), ['7','8','9','10','177','179']);
  assert.equal(citationStartPage(entry, 220, 56), 27);
  assert.ok(!citedPages(entry, 220).some(p => p.printed === '36'));
});

test('footnote 22 opens O Su-jeong at PDF 23, printed 223, not stale PDF 15', () => {
  const entry = map['fn-022']['s-1330d7b2a5d77e4e'];
  assert.equal(citationStartPage(entry, 30, 15), 23);
  assert.deepEqual(citedPages(entry, 30), [{page:23, printed:'223'}]);
});

test('footnote 198 preserves the four cited excerpt pages and their printed labels', () => {
  const entry = map['fn-198']['s-9bab1ddba025798a'];
  assert.deepEqual(citedPages(entry, 5), [{page:2,printed:'889'},{page:3,printed:'890'},{page:4,printed:'901'},{page:5,printed:'902'}]);
  assert.equal(citationStartPage(entry, 5, 1), 2);
});

test('all six audited missing source links are added only when the catalog contains them', () => {
  const missing = {'fn-029':['s-cf8c14a8c7c9f230'],'fn-107':['s-7fe61733611316a9'],'fn-147':['s-bb1d76a40eacdab4'],'fn-204':['s-e86074f028d3b57b'],'fn-218':['s-318260d6e0f0f22c','s-85a5221437939f93']};
  for (const [id, ids] of Object.entries(missing)) {
    const sourceRefs = Object.keys(map[id]).filter(sourceId => !ids.includes(sourceId)).map(sourceId => ({sourceId}));
    const sources = Object.keys(map[id]).map(id => ({id}));
    const linked = citedSourceRefs({id,sourceRefs}, map, sources).map(ref => ref.sourceId);
    assert.deepEqual(linked.slice(-ids.length), ids);
    assert.equal(new Set(linked).size, linked.length);
    assert.equal(linked.length,sourceRefs.length+ids.length,'the source count must include audited links');
    assert.deepEqual(citedSourceRefs({id,sourceRefs},map,sources.filter(s=>!ids.includes(s.id))),sourceRefs);
  }
});

test('unmapped citations do not invent a page or inherit a stale target', () => {
  const entry = map['fn-022']['s-bfea223746431fc0'];
  assert.deepEqual(citedPages(entry), []);
  assert.equal(citationStartPage(entry, 2000, 212), 1);
  assert.deepEqual(citationHighlights({id:'source',pages:2000},'fn-022',entry), []);
  assert.equal(citationStartPage(undefined, 12, 6), 6, 'explicit related-source page remains usable');
  assert.equal(citationStartPage(undefined, 12, 13), 1);
});

test('page tint and verified text rectangles remain separate, with invalid geometry excluded', () => {
  const rect = [10,20,80,35];
  const source = {id:'source', pages:2, highlights:[{page:2,noteIds:['fn'],rects:[rect,[5,5,2,2]],quote:'Text'},{page:1,noteIds:['other'],rects:[rect]}]};
  const highlights = citationHighlights(source,'fn',{basis:'test',pages:[{page:2,printed:'3'},{page:2,printed:'3'},{page:9,printed:'10'}]});
  assert.deepEqual(highlights,[{page:2,kind:'cited-page',printed:'3'},{page:2,rect,quote:'Text',kind:'exact-passage'}]);
});

test('footnote 95 highlights exact printed-page markers and preserves all original text', () => {
  const sections = map['fn-095']['s-cee6d383b2cde5ff'].textSections;
  const text = '앞부분\n[인쇄 29면]\n29면 내용\n[인쇄 30면]\n30면 내용';
  const parts = citedTextParts(text,sections);
  assert.equal(parts.map(p=>p.text).join(''),text);
  assert.deepEqual(parts.filter(p=>p.printed).map(p=>p.printed),['29','30']);
  assert.equal(parts[0].printed,undefined);
  assert.equal(parts[1].text,'[인쇄 29면]\n29면 내용\n');
  assert.equal(citedTextParts('표지가 없는 원문',sections).some(p=>p.printed),false);
  assert.equal(citedTextParts('[인쇄 29면] 내용 [인쇄 29면] 반복',sections).some(p=>p.printed),false);
});

test('the complete audited map retains 246 footnotes, 378 source pairs and 691 pages', () => {
  assert.equal(Object.keys(map).length,246);
  const entries=Object.values(map).flatMap(x=>Object.values(x));
  assert.equal(entries.length,378);
  assert.equal(entries.reduce((n,e)=>n+citedPages(e).length,0),691);
  assert.equal(citedPageLabel('223'),'223면');
  assert.equal(citedPageLabel('4 (PDF쪽)'),'4 (PDF쪽)');
});
