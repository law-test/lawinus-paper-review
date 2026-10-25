import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {clampPopupOffset} from '../src/popup-position.ts';

const code=ts.transpileModule(readFileSync(new URL('../src/use-popup-drag.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const plain=value=>({x:value.x,y:value.y});
function eventSurface(){const listeners=new Map();return {listeners,addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},removeEventListener(name,fn){listeners.get(name)?.delete(fn);},emit(name,event){for(const fn of [...(listeners.get(name)||[])])fn(event);},count(){return [...listeners.values()].reduce((n,set)=>n+set.size,0);}};}
function harness({base={left:100,top:90,width:400,height:300},width=1000,height=800,enabled=true,topInset=64,visual=true,boundary='panel',headerHeight=64}={}){
 const states=[],refs=[],effects=[],pendingEffects=[],frames=new Map(),observers=[];
 let stateCursor=0,refCursor=0,effectCursor=0,frameSerial=0,domOffset={x:0,y:0},result;
 class Element{interactive=false;focuses=[];captures=new Set();released=[];closest(){return this.interactive?this:null;}focus(options){this.focuses.push(options);}setPointerCapture(id){this.captures.add(id);}hasPointerCapture(id){return this.captures.has(id);}releasePointerCapture(id){this.captures.delete(id);this.released.push(id);}}
 const handle=new Element(),element=new Element();element.getBoundingClientRect=()=>({...base,left:base.left+domOffset.x,top:base.top+domOffset.y});
 handle.getBoundingClientRect=()=>({left:base.left+domOffset.x,top:base.top+domOffset.y,bottom:base.top+domOffset.y+headerHeight,width:base.width,height:headerHeight});
 element.querySelector=selector=>selector==='[data-popup-drag-handle]:not([data-popup-drag-hidden="true"])'?handle:null;
 const viewport={...eventSurface(),offsetLeft:0,offsetTop:0,width,height};
 const window={...eventSurface(),innerWidth:width,innerHeight:height,visualViewport:visual?viewport:undefined};
 const options={enabled,elementRef:{current:element},topInset,margin:8,layoutKey:'both',boundary};
 class ResizeObserver{constructor(callback){this.callback=callback;this.targets=[];this.disconnected=false;observers.push(this);}observe(target){this.targets.push(target);}disconnect(){this.disconnected=true;}fire(){if(!this.disconnected)this.callback();}}
 const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,window,Element,ResizeObserver,requestAnimationFrame:fn=>{const id=++frameSerial;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),require:id=>{
  if(id==='./popup-position')return {clampPopupOffset};
  if(id==='react')return {useState:initial=>{const i=stateCursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];},useRef:initial=>refs[refCursor++]??=({current:initial}),useLayoutEffect:(fn,deps)=>{const i=effectCursor++,old=effects[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n]))){pendingEffects.push(()=>{old?.cleanup?.();effects[i]={deps:[...deps],cleanup:fn()};});}}};
  throw new Error(`Unexpected import ${id}`);
 }});
 function commit(next={}){Object.assign(options,next);stateCursor=0;refCursor=0;effectCursor=0;pendingEffects.length=0;result=module.exports.usePopupDrag(options);domOffset=options.enabled?plain(result.offset):{x:0,y:0};for(const run of pendingEffects.splice(0))run();return result;}
 function raf(){const queued=[...frames.values()];frames.clear();for(const fn of queued)fn();}
 function pointer(overrides={}){return {button:0,isPrimary:true,pointerId:1,clientX:100,clientY:100,target:handle,currentTarget:handle,prevented:0,preventDefault(){this.prevented++;},...overrides};}
 function key(name,overrides={}){return {key:name,target:handle,currentTarget:handle,shiftKey:false,prevented:0,preventDefault(){this.prevented++;},...overrides};}
 commit();raf();commit();
 return {base,options,element,handle,window,viewport,frames,observers,Element,commit,raf,pointer,key,get result(){return result;},get offset(){return plain(states[0]);},get dragging(){return states[1];},get domOffset(){return domOffset;},unmount(){for(const effect of effects)effect?.cleanup?.();}};
}

test('clamp respects viewport margins, toolbar, and the available full-window rectangle',()=>{
 const base={left:100,top:90,width:400,height:300},view={left:0,top:0,width:1000,height:800};
 assert.deepEqual(clampPopupOffset({x:-999,y:-999},base,view,8,64),{x:-92,y:-26});
 assert.deepEqual(clampPopupOffset({x:999,y:999},base,view,8,64),{x:492,y:402});
 assert.deepEqual(clampPopupOffset({x:80,y:80},{left:8,top:64,width:984,height:728},view,8,64),{x:0,y:0});
 const oversized=clampPopupOffset({x:30,y:30},{left:100,top:90,width:1300,height:900},view,8,64);
 assert.deepEqual(oversized,{x:-92,y:-26},'oversized rectangles keep their title at the safe top-left; this is not a claim that their bottom fits');
});

test('only the primary main-button title gesture captures; interactive header descendants are excluded',()=>{
 const h=harness();
 for(const patch of [{button:1},{button:2},{isPrimary:false}]){const e=h.pointer(patch);h.result.handleProps.onPointerDown(e);assert.equal(e.prevented,0);assert.equal(h.dragging,false);}
 for(const label of ['button','anchor','input','select','textarea','summary','editable']){const target=new h.Element();target.interactive=true;const e=h.pointer({target});h.result.handleProps.onPointerDown(e);assert.equal(e.prevented,0,label);assert.equal(h.dragging,false,label);}
 const e=h.pointer();h.result.handleProps.onPointerDown(e);assert.equal(e.prevented,1);assert.equal(h.dragging,true);assert.ok(h.handle.captures.has(1));assert.equal(h.handle.focuses[0].preventScroll,true);
 h.result.handleProps.onPointerMove(h.pointer({pointerId:9,clientX:800}));assert.deepEqual(h.offset,{x:0,y:0});
 h.result.handleProps.onPointerMove(h.pointer({clientX:240,clientY:180}));assert.deepEqual(h.offset,{x:140,y:80});
 h.result.handleProps.onPointerUp(h.pointer({pointerId:9}));assert.equal(h.dragging,true);
 h.result.handleProps.onPointerUp(h.pointer());assert.equal(h.dragging,false);assert.deepEqual(h.handle.released,[1]);
});

test('rapid pointer moves use committed DOM geometry and do not drift at the screen boundary',()=>{
 const h=harness();h.result.handleProps.onPointerDown(h.pointer());
 h.result.handleProps.onPointerMove(h.pointer({clientX:1000,clientY:1000}));assert.deepEqual(h.offset,{x:492,y:402});
 assert.deepEqual(h.domOffset,{x:0,y:0},'the first state update has not yet changed the DOM');
 h.result.handleProps.onPointerMove(h.pointer({clientX:1100,clientY:1100}));assert.deepEqual(h.offset,{x:492,y:402});
 h.result.handleProps.onPointerMove(h.pointer({clientX:900,clientY:900}));assert.deepEqual(h.offset,{x:492,y:402});
 h.commit();h.result.handleProps.onPointerMove(h.pointer({clientX:500,clientY:300}));assert.deepEqual(h.offset,{x:400,y:200});
 h.result.handleProps.onPointerMove(h.pointer({clientX:520,clientY:320}));assert.deepEqual(h.offset,{x:420,y:220});
});

test('pointer cancellation, lost capture, and unavailable capture APIs leave no active drag',()=>{
 for(const ending of ['onPointerCancel','onLostPointerCapture']){const h=harness();h.result.handleProps.onPointerDown(h.pointer());h.result.handleProps[ending](h.pointer());assert.equal(h.dragging,false);const before=h.offset;h.result.handleProps.onPointerMove(h.pointer({clientX:900}));assert.deepEqual(h.offset,before);}
 const h=harness();h.handle.setPointerCapture=()=>{throw new Error('capture unavailable');};assert.doesNotThrow(()=>h.result.handleProps.onPointerDown(h.pointer()));h.result.handleProps.onPointerCancel(h.pointer());assert.equal(h.dragging,false);
});

test('keyboard arrows, Shift acceleration, Home and title double-click preserve embedded controls',()=>{
 const h=harness();
 h.result.handleProps.onKeyDown(h.key('ArrowRight'));h.result.handleProps.onKeyDown(h.key('ArrowDown',{shiftKey:true}));assert.deepEqual(h.offset,{x:16,y:48});
 h.commit();h.result.handleProps.onKeyDown(h.key('ArrowLeft'));h.result.handleProps.onKeyDown(h.key('ArrowUp'));assert.deepEqual(h.offset,{x:0,y:32});
 const target=new h.Element();target.interactive=true;h.result.handleProps.onKeyDown(h.key('Home',{target}));assert.deepEqual(h.offset,{x:0,y:32});
 h.result.handleProps.onDoubleClick({target});assert.deepEqual(h.offset,{x:0,y:32});
 const home=h.key('Home');h.result.handleProps.onKeyDown(home);assert.equal(home.prevented,1);assert.deepEqual(h.offset,{x:0,y:0});
 h.result.handleProps.onKeyDown(h.key('ArrowRight'));h.result.handleProps.onDoubleClick({target:h.handle});assert.deepEqual(h.offset,{x:0,y:0});
 const unrelated=h.key('Escape');h.result.handleProps.onKeyDown(unrelated);assert.equal(unrelated.prevented,0,'the owning dialog keeps its existing Escape handling');
});

test('viewport resize ends pointer capture and clamps against the smaller visible area',()=>{
 const h=harness();h.result.handleProps.onPointerDown(h.pointer());h.result.handleProps.onPointerMove(h.pointer({clientX:1000,clientY:1000}));h.commit();
 h.viewport.width=640;h.viewport.height=500;h.window.emit('resize');assert.equal(h.dragging,false);assert.ok(!h.handle.captures.has(1));h.raf();
 assert.deepEqual(h.offset,{x:132,y:102});
 h.commit();h.viewport.offsetLeft=300;h.viewport.offsetTop=240;h.viewport.emit('scroll');h.raf();h.commit();
 assert.deepEqual(h.offset,{x:208,y:214});const r=h.element.getBoundingClientRect();assert.equal(r.left,308);assert.equal(r.top,304);
});

test('native element resizing and fullscreen-sized geometry are rechecked without adding listeners',()=>{
 const h=harness();h.result.handleProps.onKeyDown(h.key('ArrowRight',{shiftKey:true}));h.commit();
 h.base.width=920;h.observers.at(-1).fire();h.raf();assert.deepEqual(h.offset,{x:-28,y:0});
 h.commit();h.base.left=8;h.base.top=64;h.base.width=984;h.base.height=728;h.observers.at(-1).fire();h.raf();assert.deepEqual(h.offset,{x:0,y:0});
 assert.equal(h.window.count(),5);assert.equal(h.viewport.count(),2);assert.equal(h.observers.length,1);
});

test('layout changes reobserve a fixed-size window and clamp its new base position',()=>{
 const h=harness();h.result.handleProps.onKeyDown(h.key('ArrowRight',{shiftKey:true}));h.commit();
 h.base.left=700;h.commit({layoutKey:'single'});assert.equal(h.observers[0].disconnected,true);h.raf();assert.deepEqual(h.offset,{x:-108,y:0});
 assert.equal(h.window.count(),5);assert.equal(h.viewport.count(),2);
});

test('a layout change during a drag releases capture and clears the dragging presentation',()=>{
 const h=harness();h.result.handleProps.onPointerDown(h.pointer());assert.equal(h.dragging,true);
 h.commit({layoutKey:'single'});h.raf();assert.ok(!h.handle.captures.has(1));assert.equal(h.dragging,false);
});

test('Home and title double-click keep a manually enlarged window inside the screen',()=>{
 for(const reset of ['keyboard','double-click']){const h=harness();h.base.width=920;h.observers.at(-1).fire();h.raf();h.commit();assert.deepEqual(h.offset,{x:-28,y:0});
  if(reset==='keyboard')h.result.handleProps.onKeyDown(h.key('Home'));else h.result.handleProps.onDoubleClick({target:h.handle});
  h.commit();const r=h.element.getBoundingClientRect();assert.ok(r.left+r.width<=992,`${reset}: ${r.left+r.width} exceeds the safe right edge`);
 }
});

test('compact disabling resets offsets, cancels work, and re-enabling installs one observer',()=>{
 const h=harness();h.result.handleProps.onPointerDown(h.pointer());h.result.handleProps.onPointerMove(h.pointer({clientX:240}));h.commit();
 h.commit({enabled:false});assert.deepEqual(h.offset,{x:0,y:0});assert.equal(h.dragging,false);assert.equal(h.window.count(),0);assert.equal(h.viewport.count(),0);assert.equal(h.frames.size,0);
 h.commit();assert.equal(h.result.handleProps.tabIndex,undefined);h.result.handleProps.onPointerDown(h.pointer());assert.equal(h.dragging,false);h.result.handleProps.onKeyDown(h.key('ArrowRight'));assert.deepEqual(h.offset,{x:0,y:0});
 h.commit({enabled:true});assert.equal(h.window.count(),5);assert.equal(h.viewport.count(),2);assert.equal(h.observers.length,2);
});

test('cleanup disconnects observers, removes listeners, cancels scheduled frames and releases capture',()=>{
 const h=harness();h.result.handleProps.onPointerDown(h.pointer());h.observers[0].fire();assert.ok(h.frames.size>0);h.unmount();
 assert.equal(h.frames.size,0);assert.equal(h.window.count(),0);assert.equal(h.viewport.count(),0);assert.equal(h.observers[0].disconnected,true);assert.ok(!h.handle.captures.has(1));
 const old=h.offset;h.window.emit('resize');h.viewport.emit('scroll');h.observers[0].fire();h.raf();assert.deepEqual(h.offset,old);
});

test('layout viewport fallback works without visualViewport and a closed ref can reopen safely',()=>{
 const h=harness({visual:false});h.result.handleProps.onPointerDown(h.pointer());h.result.handleProps.onPointerMove(h.pointer({clientX:900,clientY:900}));assert.deepEqual(h.offset,{x:492,y:402});
 h.commit({enabled:false,elementRef:{current:null}});h.commit({enabled:true,elementRef:{current:h.element}});h.raf();assert.equal(h.window.count(),5);assert.deepEqual(h.offset,{x:0,y:0});
});

test('an ordinary active/focus rerender keeps the current gesture and does not add observers',()=>{
 const h=harness();h.result.handleProps.onPointerDown(h.pointer());h.commit();
 assert.equal(h.dragging,true);assert.ok(h.handle.captures.has(1));assert.equal(h.observers.length,1);assert.equal(h.window.count(),5);
 h.result.handleProps.onPointerMove(h.pointer({clientX:210,clientY:260}));assert.deepEqual(h.offset,{x:110,y:160});
 h.commit();h.result.handleProps.onPointerMove(h.pointer({clientX:230,clientY:280}));assert.deepEqual(h.offset,{x:130,y:180});
 h.result.handleProps.onPointerUp(h.pointer());assert.equal(h.dragging,false);
});

test('a viewport-height window is vertically pinned by panel bounds but moves 160 pixels with header bounds',()=>{
 const geometry={base:{left:425,top:65,width:850,height:776.33},width:1701,height:849,topInset:65};
 const full=harness(geometry),fullBefore=full.offset;
 full.result.handleProps.onPointerDown(full.pointer());full.result.handleProps.onPointerMove(full.pointer({clientX:210,clientY:260}));
 assert.equal(full.offset.y,fullBefore.y,'the former full-window policy leaves no downward movement');
 const h=harness({...geometry,boundary:'header'});h.result.handleProps.onPointerDown(h.pointer());h.result.handleProps.onPointerMove(h.pointer({clientX:210,clientY:260}));
 assert.deepEqual(h.offset,{x:110,y:160});h.commit();
 h.result.handleProps.onPointerMove(h.pointer({clientX:9000,clientY:9000}));h.commit();const header=h.handle.getBoundingClientRect();
 assert.ok(header.left>=8&&header.left+header.width<=1693);assert.ok(header.top>=65&&header.bottom<=841,'whole title and close action stay visible');
 assert.ok(h.element.getBoundingClientRect().top+h.base.height>849,'content may extend below the viewport while the title remains recoverable');
 h.result.handleProps.onKeyDown(h.key('Home'));assert.deepEqual(h.offset,{x:0,y:0});
});

test('capture refusal falls back to window movement and ends on up, cancel, or window blur',()=>{
 for(const ending of ['pointerup','pointercancel','blur']){
  const h=harness();h.handle.setPointerCapture=()=>{throw Error('capture refused');};h.result.handleProps.onPointerDown(h.pointer());h.commit();
  h.window.emit('pointermove',h.pointer({pointerId:2,clientX:900}));assert.deepEqual(h.offset,{x:0,y:0});
  h.window.emit('pointermove',h.pointer({clientX:220,clientY:180}));assert.deepEqual(h.offset,{x:120,y:80});
  h.window.emit(ending,h.pointer());assert.equal(h.dragging,false,ending);h.window.emit('pointermove',h.pointer({clientX:500}));assert.deepEqual(h.offset,{x:120,y:80});
  h.unmount();assert.equal(h.window.count(),0);assert.equal(h.viewport.count(),0);
 }
});

test('header bounds recheck resizing and viewport movement without losing the reset action',()=>{
 const h=harness({boundary:'header'});h.result.handleProps.onPointerDown(h.pointer());h.result.handleProps.onPointerMove(h.pointer({clientX:600,clientY:600}));h.commit();
 h.viewport.width=600;h.viewport.height=400;h.window.emit('resize');h.raf();h.commit();
 const header=h.handle.getBoundingClientRect();assert.ok(header.left+header.width<=592);assert.ok(header.bottom<=392);assert.equal(h.dragging,false);
 h.result.handleProps.onKeyDown(h.key('Home'));h.commit();assert.deepEqual(h.offset,{x:0,y:0});assert.equal(h.result.handleProps['data-popup-drag-handle'],true);
});
