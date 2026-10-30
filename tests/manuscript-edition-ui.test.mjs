import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';

const require=createRequire(import.meta.url);
function compile(file){return ts.transpileModule(readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;}
function loadEditions(){const module={exports:{}};vm.runInNewContext(compile('manuscript-editions.ts'),{module,exports:module.exports,URLSearchParams,require:id=>id.endsWith('.json')?{default:require('../src/'+id.slice(2))}:require(id)});return module.exports;}
const editions=loadEditions();
const release=JSON.parse(readFileSync(new URL('./fixtures/edition-release284.json',import.meta.url),'utf8'));

test('the selected edition supplies its own catalog, TOC, page numbers and stable guide IDs',()=>{
 assert.equal(editions.editionFromSearch(''),'human80');assert.equal(editions.editionFromSearch('?edition=v120'),'v120');assert.equal(editions.editionFromSearch('?edition=v121'),'v121');
 for(const id of ['human80','v120','v121','v122','v123','v124']){
  const version=editions.MANUSCRIPT_EDITIONS[id],catalog=editions.editionParagraphs(id),guide=editions.editionProposals(id),expectedGuide=id==='v120'?release.guideV120:id==='v121'?release.guideV121:id==='v122'?release.guideV122:id==='v123'?release.guideV123:release.guide;
  assert.equal(catalog.length,release[id].catalog);
  assert.equal(guide.length,expectedGuide.items);assert.equal(new Set(guide.map(item=>item.id)).size,expectedGuide.items);
  assert.equal(version.toc.pdfSha256,version.catalog.pdfSha256);
  for(const item of guide){assert.ok(item.page>=1&&item.page<=version.pages,item.id);if(id!=='human80')assert.equal(item.applyText,undefined);if(item.targetParagraphId)assert.ok(catalog.some(p=>p.id===item.targetParagraphId),item.id);}
 }
 assert.deepEqual(editions.editionProposals('human80').map(p=>p.id),editions.editionProposals('v124').map(p=>p.id));
});

test('the actual edition switch keys a new workspace, clears deep links and selection, and retains the one popup controller',()=>{
 const module={exports:{}},states=[];let cursor=0,selectionClears=0,popupCalls=0;
 const popup={openTool:()=>{},layer:null},history=[];
 const window={location:{search:'?view=paragraph&paragraph=P0001',href:'https://paper.lawinus.org/?view=paragraph&paragraph=P0001'},history:{replaceState:(_a,_b,url)=>history.push(String(url))},getSelection:()=>({removeAllRanges:()=>selectionClears++})};
 vm.runInNewContext(compile('review-workspace.tsx'),{module,exports:module.exports,window,URL,require:id=>{
  if(id==='react')return {...React,useState:initial=>{const index=cursor++;if(!(index in states))states[index]=typeof initial==='function'?initial():initial;return [states[index],next=>{states[index]=next;}];}};
  if(id==='./manuscript-editions')return editions;
  if(id==='./manuscript-edition-context')return {ManuscriptEditionProvider:()=>null};
  if(id==='./workspace-tool-popups')return {useWorkspaceToolPopups:()=>{popupCalls++;return popup;}};
  return id.startsWith('.')?{}:require(id);
 }});
 const render=()=>{cursor=0;return module.exports.default();};
 const first=render().props.children;assert.equal(first.key,'human80');assert.equal(first.props.edition.datasetId,'human-1029-1629');
 first.props.onEdition('v121');const second=render().props.children;
 assert.equal(second.key,'v121');assert.equal(second.props.edition.datasetId,'applied-v121-human80');assert.equal(second.props.toolPopups,popup);
 assert.equal(selectionClears,1);assert.equal(history[0],'https://paper.lawinus.org/?edition=v121');assert.equal(popupCalls,2,'hook stays in the unkeyed parent across renders');
});
