import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {createRequire} from 'node:module';
import * as tools from '../src/workspace-tools.ts';
const require=createRequire(import.meta.url);
function memory(){const data=new Map([['paper-reading-position','keep']]);return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};}
test('one week means exactly seven days from the click, with an inclusive expiration boundary',()=>{
 const storage=memory(),now=1792917000000,until=tools.pauseGlossaryForWeek(storage,now);
 assert.equal(until,now+604800000);assert.equal(tools.glossaryPauseUntil(storage,until-1),until);
 assert.equal(tools.glossaryPauseUntil(storage,until),0);assert.equal(tools.glossaryPauseUntil(storage,until+1),0);
 assert.equal(storage.getItem('paper-reading-position'),'keep');assert.equal(storage.data.size,2);
 assert.equal(tools.shouldAutoOpenGlossary('?v=272','',false,storage,now),false);
 assert.equal(tools.shouldAutoOpenGlossary('?v=272','',false,storage,until),true);
});
test('invalid or unavailable preference storage does not produce a permanent hidden popup or a false save result',()=>{
 const storage=memory(),now=1792917000000;
 for(const raw of ['', 'NaN','Infinity','-1','true','999999999999999999999',String(now),String(now+tools.GLOSSARY_PAUSE_MS+1)]){storage.setItem(tools.GLOSSARY_AUTOSTART_PAUSE_KEY,raw);assert.equal(tools.glossaryPauseUntil(storage,now),0,raw);}
 for(const denied of [undefined,{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}},{getItem(){return null;},setItem(){}}])assert.equal(tools.pauseGlossaryForWeek(denied,now),0);
});
test('automatic entry excludes deep links and embedded or standalone views regardless of expired preference',()=>{
 const storage=memory();
 for(const search of ['?view=faq','?view=glossary','?view=glossary&dictionary=1','?chat=1','?note=fn-001','?paragraph=P0010'])assert.equal(tools.shouldAutoOpenGlossary(search,'',false,storage),false);
 assert.equal(tools.shouldAutoOpenGlossary('','#P0010',false,storage),false);assert.equal(tools.shouldAutoOpenGlossary('','',true,storage),false);
 assert.equal(tools.shouldAutoOpenGlossary('','',false,storage),true);
});
function harness(denied=false){
 const states=[],events=[],listeners=new Map(),storage=memory();let cursor=0;
 const code=ts.transpileModule(readFileSync(new URL('../src/glossary-auto-open-control.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}},win={addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n),dispatchEvent:e=>events.push(e.type)};
 vm.runInNewContext(code,{module,exports:module.exports,window:win,Event:class{constructor(type){this.type=type;}},require:id=>id==='react'?{...React,useState:initial=>{const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],next=>states[i]=typeof next==='function'?next(states[i]):next];},useEffect:fn=>fn()}:id==='./workspace-tools'?{...tools,glossaryPopupStorage:()=>denied?undefined:storage}:id.endsWith('.css')?{}:require(id)});
 return {storage,events,render(onPaused=()=>{}){cursor=0;return module.exports.default({onPaused});}};
}
test('the actual week-pause button saves the preference and announces success only after a successful write',()=>{
 const h=harness();let closed=0;let tree=h.render(()=>closed++);const before=Date.now();
 tree.props.children[0].props.onClick();tree=h.render();const until=tools.glossaryPauseUntil(h.storage);
 assert.ok(until>=before+tools.GLOSSARY_PAUSE_MS&&until<=Date.now()+tools.GLOSSARY_PAUSE_MS);
 assert.equal(closed,1);assert.equal(tree.props.children[0].props.disabled,true);assert.equal(tree.props.children[1].props.role,'status');assert.deepEqual(h.events,[tools.GLOSSARY_AUTOSTART_CHANGED]);
 const blocked=harness(true);blocked.render(()=>closed++).props.children[0].props.onClick();const failed=blocked.render();
 assert.equal(closed,1);assert.equal(failed.props.children[0].props.disabled,false);assert.equal(failed.props.children[2].props.role,'status');assert.equal(blocked.events.length,0);
});
