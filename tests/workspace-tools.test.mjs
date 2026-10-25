import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialWorkspaceTools,embeddedWorkspaceToolHref,readWorkspacePopupVisit,rememberWorkspacePopupVisit,WORKSPACE_POPUPS_SEEN_KEY,ordinaryWorkspaceEntry,standaloneWorkspaceTool,openWorkspaceTool,launchWorkspaceTool} from '../src/workspace-tools.ts';

test('start cards are limited to ordinary entry and release cache-busters',()=>{
 for(const search of ['', '?v=265c'])assert.equal(ordinaryWorkspaceEntry(search),true);
 for(const search of ['?view=faq','?view=glossary','?view=ai-mingyu&chat=1','?view=glossary&dictionary=1','?proposal=P0384','?note=fn-001','?paragraph=P0283','?view=unknown','?search=term'])assert.equal(ordinaryWorkspaceEntry(search),false);
 assert.equal(ordinaryWorkspaceEntry('?v=265c','#P0283'),false);
});
test('the glossary standalone route is explicit and retains the existing chat route',()=>{
 assert.equal(standaloneWorkspaceTool('?view=glossary&dictionary=1'),'glossary');
 assert.equal(standaloneWorkspaceTool('?view=glossary'),null);
 assert.equal(standaloneWorkspaceTool('?dictionary=1'),null);
 assert.equal(standaloneWorkspaceTool('?view=faq&dictionary=1'),null);
 assert.equal(standaloneWorkspaceTool('?chat=1'),'ai-mingyu');
 assert.equal(standaloneWorkspaceTool('?view=ai-mingyu&chat=1'),'ai-mingyu');
 assert.equal(standaloneWorkspaceTool('?view=glossary&dictionary=1&chat=1'),'ai-mingyu');
});
function browser(width=1700,blocked=false){
 const calls=[],windows=[];let focused=0;const location={href:'https://paper.lawinus.org/?paragraph=P0283&v=265c#source'};
 return {location,innerWidth:width,calls,windows,get focused(){return focused;},open(...args){calls.push(args);if(blocked)return null;const opened={closed:false,opener:{},focus(){focused++;}};windows.push(opened);return opened;}};
}
test('desktop launches glossary and blocks paused AI without moving the paper',()=>{
 const b=browser();const original=b.location.href;
 assert.equal(openWorkspaceTool('ai-mingyu',b),false);assert.equal(openWorkspaceTool('glossary',b),true);
 assert.equal(b.location.href,original);assert.equal(b.focused,1);
 assert.deepEqual(b.calls.map(c=>c.slice(0,2)),[['https://paper.lawinus.org/?view=glossary&dictionary=1','lawinus-glossary']]);
 assert.ok(b.calls.every(c=>c[2].includes('popup,')&&c[2].includes('scrollbars=yes')));
});
test('small screens open the available glossary in a new tab instead of replacing the paper',()=>{
 const b=browser(390);const original=b.location.href;
 assert.equal(openWorkspaceTool('ai-mingyu',b),false);assert.equal(openWorkspaceTool('glossary',b),true);
 assert.equal(b.location.href,original);assert.equal(b.calls.length,1);assert.ok(b.calls.every(c=>c[1]==='lawinus-glossary'&&c.length===2));
});
test('blocked popups leave the native new-tab link available',()=>{
 const b=browser(1700,true);assert.equal(openWorkspaceTool('glossary',b),false);
 let prevented=false;
 launchWorkspaceTool({button:0,metaKey:false,ctrlKey:false,shiftKey:false,altKey:false,preventDefault(){prevented=true;}},'glossary',()=>false);
 assert.equal(prevented,false);
});
test('modifier and middle-button clicks retain browser-native link behavior',()=>{
 for(const change of [{button:1},{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true}]){
  let calls=0,prevented=false;
  launchWorkspaceTool({button:0,metaKey:false,ctrlKey:false,shiftKey:false,altKey:false,...change,preventDefault(){prevented=true;}},'glossary',()=>{calls++;return true;});
  assert.equal(calls,0);assert.equal(prevented,false);
 }
});

test('no first visit or explicit entry opens a tool automatically',()=>{
 for(const search of ['', '?v=265c'])assert.deepEqual(initialWorkspaceTools(search,'',false,false),[]);
 for(const [search,hash,embedded,seen] of [['','',false,true],['','',true,false],['','#P0283',false,false],['?paragraph=P0283','',false,false],['?view=ai-mingyu','',false,false],['?view=glossary&dictionary=1&embedded=1','',true,false]])assert.deepEqual(initialWorkspaceTools(search,hash,embedded,seen),[]);
 for(const tool of ['ai-mingyu','glossary']){const url=new URL(embeddedWorkspaceToolHref(tool),'https://paper.lawinus.org/');assert.equal(standaloneWorkspaceTool(url.search),tool);assert.equal(url.searchParams.get('embedded'),'1');}
});

test('an existing tool window is focused without navigating or reloading it; a closed one reopens',()=>{
 for(const width of [1700,390]){
  const b=browser(width);assert.equal(openWorkspaceTool('glossary',b),true);const first=b.windows[0];assert.equal(first.opener,null);
  assert.equal(openWorkspaceTool('glossary',b),true);assert.equal(b.calls.length,1);assert.equal(b.focused,2);
  first.closed=true;assert.equal(openWorkspaceTool('glossary',b),true);assert.equal(b.calls.length,2);assert.notEqual(b.windows[1],first);
 }
});

test('a refused window API returns the blocked result without navigating the original paper',()=>{
 const b=browser(),original=b.location.href;b.open=()=>{throw Error('blocked');};assert.equal(openWorkspaceTool('glossary',b),false);assert.equal(b.location.href,original);
});
test('popup first-visit storage touches only its own key and safely handles unavailable storage',()=>{
 const values=new Map([['reading-position','12345']]);const writes=[];const storage={getItem:key=>values.get(key),setItem:(key,value)=>{writes.push(key);values.set(key,value);}};
 assert.equal(readWorkspacePopupVisit(storage),false);assert.equal(rememberWorkspacePopupVisit(storage),true);assert.equal(readWorkspacePopupVisit(storage),true);
 assert.deepEqual(writes,[WORKSPACE_POPUPS_SEEN_KEY]);assert.equal(values.get('reading-position'),'12345');
 const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};assert.equal(readWorkspacePopupVisit(denied),false);assert.equal(rememberWorkspacePopupVisit(denied),false);assert.equal(rememberWorkspacePopupVisit(undefined),false);
});
