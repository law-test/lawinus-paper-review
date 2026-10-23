import assert from 'node:assert/strict';
import {test} from 'node:test';
import {footnoteTargets,targetAt,normalizedPoint,pageLayout,pageIndexAt,visiblePageRange,reflowScrollPosition,movedPointer} from '../src/pdf-viewer-model.ts';

// Actual fn-001 coordinates from the unchanged human-1021-1559 manifest.
const first={id:'fn-001',number:1,clickTargets:[{page:20,rect:[117.16,390.416,124.53,398.69],kind:'body-marker'},{page:20,rect:[56.543,546.952,62.47,553.667],kind:'footnote-marker'}],noteHighlights:[{page:20,rect:[62.533,547.048,464.014,556.041],kind:'footnote-text'},{page:20,rect:[69.601,563.716,170.157,572.709],kind:'footnote-text'}]};
test('full two-line footnote and original body superscript are independently clickable',()=>{
  const targets=footnoteTargets([first]);assert.equal(targets.length,4);
  assert.equal(targetAt(targets,300,551)?.noteId,'fn-001');assert.equal(targetAt(targets,140,568)?.noteId,'fn-001');
  assert.equal(targetAt(targets,120,395)?.kind,'body-marker');
  assert.equal(targetAt(targets,300,568),undefined,'short final line must not expand into blank space');
  assert.equal(targetAt(targets,140,560),undefined,'line gap must not become a union rectangle');
});
test('continuations retain their own page and do not overlap a later footnote',()=>{
  // Synthetic boundary fixture verifies the viewer, not a claim of a source continuation.
  const notes=[first,{id:'fn-002',number:2,noteHighlights:[{page:20,rect:[60,580,300,589]},{page:21,rect:[60,50,400,59]}]}];
  const all=footnoteTargets(notes),p20=all.filter(x=>x.page===20),p21=all.filter(x=>x.page===21);
  assert.equal(targetAt(p20,140,568)?.noteId,'fn-001');assert.equal(targetAt(p20,140,585)?.noteId,'fn-002');
  assert.equal(targetAt(p21,140,55)?.noteId,'fn-002');assert.equal(targetAt(p20,140,55),undefined);
});
test('invalid geometry is ignored and duplicate evidence rectangles are not duplicated',()=>{
  const x={id:'fn-009',number:9,clickTargets:[{page:1,rect:[1,1,9,9]}],noteHighlights:[{page:1,rect:[1,1,9,9]},{page:1,rect:[9,1,1,9]},{page:0,rect:[1,1,2,2]},{page:2,rect:[NaN,1,3,3]}]};
  assert.equal(footnoteTargets([x]).length,1);
});
test('pointer coordinates remain exact at zoom and inside a scrolled page',()=>{
  assert.deepEqual(normalizedPoint(300,450,{left:100,top:50,width:400,height:800}),{x:.5,y:.5});
  assert.deepEqual(normalizedPoint(900,0,{left:100,top:50,width:400,height:800}),{x:1,y:0});
  assert.equal(movedPointer({x:10,y:20},12,22),false);assert.equal(movedPointer({x:10,y:20},10,30),true);
});
test('279-page document renders only viewport neighbors, including at the end',()=>{
  const layout=pageLayout(279,515,1,{});const p20=layout.offsets[19];
  const visible=visiblePageRange(layout.offsets,p20,900,1);assert.deepEqual(visible,[19,20,21,22]);assert.ok(visible.length<10);
  assert.equal(pageIndexAt(layout.offsets,p20),19);assert.equal(pageIndexAt(layout.offsets,1e9),278);assert.equal(pageIndexAt(layout.offsets,-10),0);
  assert.deepEqual(visiblePageRange(layout.offsets,layout.offsets[278],900,1),[278,279]);
});
test('zoom/column resize keeps the same page and relative reading position',()=>{
  const before=pageLayout(279,515,1,{}),after=pageLayout(279,600,1.5,{});
  const oldPosition=before.offsets[49]+before.heights[49]*.4,newPosition=reflowScrollPosition(before,after,oldPosition);
  assert.equal(pageIndexAt(after.offsets,newPosition),49);
  assert.ok(Math.abs((newPosition-after.offsets[49])/after.heights[49]-.4)<1e-9);
});
test('mixed page sizes use their measured height without merging left/right document navigation',()=>{
  const thesis=pageLayout(279,515,1,{}),source=pageLayout(3,600,1,{2:{width:800,height:400}},{width:600,height:900});
  assert.equal(source.heights[0],900);assert.equal(source.heights[1],300);assert.equal(source.offsets[2],1248);
  assert.equal(pageIndexAt(source.offsets,1248),2);assert.equal(pageIndexAt(thesis.offsets,1248),1);
});
