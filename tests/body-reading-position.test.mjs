import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseBodyReadingPosition,bodyAnchorTop,bodyReadingKey} from '../src/body-reading-position.ts';
test('body bookmark roundtrip retains an offset within a later page',()=>{const p={page:249,reportedPage:249,fraction:.437,leftRatio:.15,zoom:1.3};assert.deepEqual(parseBodyReadingPosition(JSON.stringify(p)),p);assert.equal(bodyAnchorTop(200000,1000,.437),200437);assert.equal(bodyAnchorTop(400000,2000,.437),400874);});
test('invalid or oversized browser data cannot become a body position',()=>{for(const raw of [null,'x','null','[]','x'.repeat(3000),JSON.stringify({page:0,reportedPage:1,fraction:.5,leftRatio:0,zoom:1}),JSON.stringify({page:1,reportedPage:1,fraction:-1,leftRatio:0,zoom:1}),JSON.stringify({page:1,reportedPage:1,fraction:.5,leftRatio:0,zoom:99})])assert.equal(parseBodyReadingPosition(raw),null);});
test('body positions are isolated by document and constrained to their page',()=>{assert.notEqual(bodyReadingKey('dataset-a:body'),bodyReadingKey('dataset-b:body'));assert.equal(bodyAnchorTop(100,200,5),300);assert.equal(bodyAnchorTop(100,200,-5),100);});
