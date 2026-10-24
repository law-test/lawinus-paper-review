import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pageLayout,capturePdfReadingPosition,restorePdfReadingPosition,readPdfReadingPosition,writePdfReadingPosition,pdfReadingStorageKey} from '../src/pdf-viewer-model.ts';

function storage(){const data=new Map();return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('same-size refresh restores the exact vertical and horizontal pixel position independently per document',()=>{
 const s=storage(),layout=pageLayout(279,366,1.6,{}),source=pageLayout(220,366,1.3,{});
 const a=capturePdfReadingPosition('human-1021-1559:thesis',layout,layout.offsets[248]+layout.heights[248]*.37+18,121.25,249,1.6,{});
 const b=capturePdfReadingPosition('human-1021-1559:s-original',source,source.offsets[28]+source.heights[28]*.68+18,72,29,1.3,{});
 assert.ok(writePdfReadingPosition(s,a));assert.ok(writePdfReadingPosition(s,b));
 assert.deepEqual(restorePdfReadingPosition(readPdfReadingPosition(s,a.key,279),layout),{page:249,top:a.top,left:a.left});
 assert.deepEqual(restorePdfReadingPosition(readPdfReadingPosition(s,b.key,220),source),{page:29,top:b.top,left:b.left});
 assert.equal(s.data.size,2);assert.equal(readPdfReadingPosition(s,'another:thesis',279),null);
});
test('a changed viewport restores the same page fraction and proportional horizontal position',()=>{
 const before=pageLayout(279,820,2,{}),after=pageLayout(279,366,2,{});
 const p=capturePdfReadingPosition('dataset:thesis',before,before.offsets[248]+before.heights[248]*.43+18,700,249,2,{});
 const next=restorePdfReadingPosition(p,after);
 close(next.top,after.offsets[248]+after.heights[248]*.43+18);close(next.left,700*366/820);assert.equal(next.page,249);
});
test('cached measured reference-page geometry gives exact restoration while unseen page shapes use an anchor',()=>{
 const sizes={1:{width:612,height:792},2:{width:800,height:400},28:{width:640,height:960},29:{width:640,height:960}};
 const before=pageLayout(48,366,1.3,sizes),p=capturePdfReadingPosition('dataset:source',before,before.offsets[28]+before.heights[28]*.65+18,30,29,1.3,sizes);
 const cached=Object.fromEntries(p.sizes.map(([page,width,height])=>[page,{width,height}]));
 assert.deepEqual(restorePdfReadingPosition(p,pageLayout(48,366,1.3,cached)),{page:29,top:p.top,left:30});
 const newlyKnown=pageLayout(48,366,1.3,{...cached,10:{width:800,height:400}}),next=restorePdfReadingPosition(p,newlyKnown);
 close(next.top,newlyKnown.offsets[28]+newlyKnown.heights[28]*.65+18);
});
test('explicit page navigation wins over a saved anchor even when its page number is unchanged',()=>{
 const layout=pageLayout(48,366,1,{}),p=capturePdfReadingPosition('dataset:source',layout,layout.offsets[26]+200,0,27,1,{});
 assert.equal(restorePdfReadingPosition(p,layout,true),null);
 assert.equal(restorePdfReadingPosition(p,pageLayout(47,366,1,{})),null);
 assert.equal(restorePdfReadingPosition(p,layout).page,27,'the final PDF page can recover a stale parent page snapshot');
});
test('top-of-document and inter-page gaps preserve the exact offset without padding drift',()=>{
 const before=pageLayout(48,366,1,{}),after=pageLayout(48,800,1,{});
 const start=capturePdfReadingPosition('d:s',before,0,0,1,1,{});assert.equal(restorePdfReadingPosition(start,after).top,0);
 const gap=capturePdfReadingPosition('d:s',before,before.offsets[10]+before.heights[10]+9+18,0,12,1,{});
 assert.equal(gap.anchorPage,11);assert.equal(gap.page,12);close(gap.gapOffset,9);
 close(restorePdfReadingPosition(gap,after).top,after.offsets[10]+after.heights[10]+9+18);
});
test('untrusted storage is bounded and malformed values cannot change unrelated records',()=>{
 const s=storage(),layout=pageLayout(48,366,1,{}),p=capturePdfReadingPosition('d:s',layout,500,0,1,1,{}),name=pdfReadingStorageKey('d:s');
 const invalid=[null,{}, {...p,version:2},{...p,key:'other'}, {...p,pages:999}, {...p,page:0},{...p,anchorPage:49},{...p,top:-1},{...p,fraction:2},{...p,width:0},{...p,zoom:100},{...p,sizes:[[1,0,90]]},{...p,sizes:[[1,500,700],[1,500,700]]},{...p,sizes:Array(257).fill([1,500,700])}];
 for(const item of invalid){s.setItem(name,JSON.stringify(item));assert.equal(readPdfReadingPosition(s,'d:s',48),null);}
 for(const raw of ['broken','x'.repeat(65537)]){s.setItem(name,raw);assert.equal(readPdfReadingPosition(s,'d:s',48),null);}
 assert.equal(pdfReadingStorageKey('../private'),null);assert.equal(pdfReadingStorageKey('x'.repeat(242)),null);
 const broken={getItem(){throw Error('disabled');},setItem(){throw Error('quota');}};
 assert.equal(readPdfReadingPosition(broken,'d:s',48),null);assert.equal(writePdfReadingPosition(broken,p),false);
 assert.equal(writePdfReadingPosition(undefined,p),false);assert.equal(readPdfReadingPosition(undefined,'d:s',48),null);
});
test('large documents store only a bounded set of measured page shapes closest to the reading anchor',()=>{
 const sizes=Object.fromEntries(Array.from({length:1000},(_,i)=>[i+1,{width:515,height:728}])),layout=pageLayout(1000,366,1,sizes);
 const p=capturePdfReadingPosition('d:large',layout,layout.offsets[899]+40,0,900,1,sizes);
 assert.equal(p.sizes.length,256);assert.equal(p.sizes[0][0],900);
 assert.ok(JSON.stringify(p).length<65536);
});
