import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectedPdfText} from '../src/pdf-selection.ts';
test('copy preserves the selected text, spacing and line breaks within one PDF pane',()=>{
 const a={},b={},host={contains:n=>[a,b].includes(n)};
 const selected={isCollapsed:false,anchorNode:a,focusNode:b,toString:()=> '주택임차인의 권리\n예외 및 요건'};
 assert.equal(selectedPdfText(host,selected),'주택임차인의 권리\n예외 및 요건');
 assert.equal(selectedPdfText(host,{...selected,focusNode:{}}),'');
 assert.equal(selectedPdfText(host,{...selected,isCollapsed:true}),'');
 assert.equal(selectedPdfText(null,selected),'');assert.equal(selectedPdfText(host,null),'');
});
