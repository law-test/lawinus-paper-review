import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DEFAULT_FOUR_PANE_CUTS,normalizeFourPaneCuts,moveFourPaneBoundary,fourPaneColumns} from '../src/four-pane-size.ts';

test('missing and malformed saved dividers retain usable document widths',()=>{
  assert.deepEqual(normalizeFourPaneCuts(null),DEFAULT_FOUR_PANE_CUTS);
  assert.deepEqual(normalizeFourPaneCuts({thesis:NaN,sourceEnd:'wide'}),DEFAULT_FOUR_PANE_CUTS);
  for(const stored of [{thesis:100,sourceEnd:10},{thesis:-10,sourceEnd:900},{thesis:58,sourceEnd:20}]){
    const c=normalizeFourPaneCuts(stored);
    assert.ok(c.thesis>=22);
    assert.ok(c.sourceEnd-c.thesis>=20);
    assert.ok(100-c.sourceEnd>=20);
  }
});
test('each document divider moves independently without collapsing its neighbor',()=>{
  const c={thesis:40,sourceEnd:72};
  assert.deepEqual(moveFourPaneBoundary(c,'thesis',48),{thesis:48,sourceEnd:72});
  assert.deepEqual(moveFourPaneBoundary(c,'source',76),{thesis:40,sourceEnd:76});
  assert.deepEqual(moveFourPaneBoundary(c,'thesis',99),{thesis:52,sourceEnd:72});
  assert.deepEqual(moveFourPaneBoundary(c,'source',-99),{thesis:40,sourceEnd:60});
  assert.deepEqual(moveFourPaneBoundary(c,'source',Infinity),c);
  assert.deepEqual(c,{thesis:40,sourceEnd:72});
});
test('grid proportions exclude the two drag handles from document widths',()=>{
  assert.equal(fourPaneColumns({thesis:40,sourceEnd:72}),'minmax(0, 40fr) 6px minmax(0, 32fr) 6px minmax(0, 28fr)');
});
