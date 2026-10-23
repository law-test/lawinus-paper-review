import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {currentTocId, visibleToc} from '../src/thesis-toc-model.ts';

const toc = JSON.parse(readFileSync(new URL('../src/thesis-toc-data.json', import.meta.url), 'utf8'));

test('detailed contents stay tied to the unchanged 279-page human PDF', () => {
  assert.equal(toc.pdfSha256, '81ef0ae033b078406e5434eae6291c2eb2bc71a6aa27d5715c4ca0e35ee031d6');
  assert.equal(toc.pageCount, 279);
  assert.equal(toc.entries.length, 169);
  assert.equal(new Set(toc.entries.map(entry => entry.id)).size, 169);
  for (let index = 1; index < toc.entries.length; index++) {
    assert.ok(toc.entries[index].page >= toc.entries[index - 1].page);
    assert.ok(toc.entries[index].level <= toc.entries[index - 1].level + 1);
  }
});

test('stale printed contents and incomplete PDF bookmarks do not dictate anchors', () => {
  const heading = title => toc.entries.find(entry => entry.title === title);
  assert.equal(heading('제4장 임대인의 도산절차에서 임차보증금반환채권의 현실화').page, 142);
  assert.equal(heading('제3절 우선변제권의 행사와 채권액·배당액의 산정').page, 62);
  assert.equal(heading('Ⅱ. 경매신청과 배당참가의 구별').page, 65);
  assert.equal(heading('4. 면책·폐지 후의 권리행사').page, 246);
  assert.equal(heading('제5장 결론').page, 255);
  assert.equal(heading('참고문헌').page, 264);
});

test('search keeps ancestors, including when matching a deep numbered heading', () => {
  const found = visibleToc(toc.entries, '면책 · 폐지 후', false);
  assert.deepEqual(found.map(entry => entry.level), [1, 2, 3, 4]);
  assert.equal(found.at(-1).page, 246);
  assert.equal(found[0].page, 142);
  assert.deepEqual(visibleToc(toc.entries, '존재하지않는목차', true), []);
});

test('chapter/section mode does not hide a detailed search result', () => {
  assert.ok(visibleToc(toc.entries, '', false).every(entry => entry.level <= 2));
  assert.equal(visibleToc(toc.entries, '', true).length, 169);
  assert.ok(visibleToc(toc.entries, '변제계획의 기재사항', false).some(entry => entry.level === 4));
});

test('same-page headings preserve a clicked title; scrolling selects the corresponding chapter', () => {
  const chapter = toc.entries.find(entry => entry.title === '제4장 임대인의 도산절차에서 임차보증금반환채권의 현실화');
  assert.equal(currentTocId(toc.entries, 142, chapter.id), chapter.id);
  assert.equal(toc.entries.find(entry => entry.id === currentTocId(toc.entries, 145, chapter.id)).title, '2. 파산면책 후 반환청구와 우선변제권');
  assert.equal(currentTocId(toc.entries, 0), undefined);
});
