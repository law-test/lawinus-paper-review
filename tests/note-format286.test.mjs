import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);let edition='human80';
const cache=new Map();
function load(file){
 if(cache.has(file))return cache.get(file);
 const source=readFileSync(new URL('../src/'+file,import.meta.url),'utf8');
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const module={exports:{}};
 const mocks={'./manuscript-edition-context':{useManuscriptEditionId:()=>edition},'./legal-link-model':{getLegalMentions:()=>[]},'./source-text':{__esModule:true,default:({text})=>text},'./reader-controls':{__esModule:true,default:()=>null},'./body-reading-hook':{useBodyReadingPosition:()=>()=>{}},'./use-popup-drag':{},'./proposal-indicators':{proposalLabel:()=>''}};
 vm.runInNewContext(output,{module,exports:module.exports,require:n=>n.endsWith('.css')?{}:mocks[n]??(n==='./legal-links'?load('legal-links.tsx'):n==='./manuscript-format'?load('manuscript-format.ts'):require(n))});
 cache.set(file,module.exports);return module.exports;
}
const {LegalText}=load('legal-links.tsx'),{default:Reader}=load('web-manuscript.tsx');
test('v127 and archived editions render native body and footnote marker styles',()=>{
 for(edition of ['human80','v126','v127']){
  const label=edition==='v127'?'12':'12)';
  const inline=renderToStaticMarkup(React.createElement(LegalText,{text:'채권[^12]',onNote(){}}));
  assert.match(inline,new RegExp('>'+label.replace(')','\\)')+'</button>'));
  const page=renderToStaticMarkup(React.createElement(Reader,{paragraphs:[{id:'P0001',text:'채권[^12]',page:1,printed:1,kind:'paragraph',heading:false,order:1,rects:[]}],notes:[{id:'fn-012',number:12,page:1,text:'출전'}],overrides:{},page:1,zoom:1,selected:'',onPageChange(){},onParagraph(){},onNote(){},onReference(){}}));
  assert.ok(page.includes(`<sup>${label}</sup>`));
  assert.ok(page.includes('각주 12 상세정보'));
 }
});
