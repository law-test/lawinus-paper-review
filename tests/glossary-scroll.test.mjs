import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';

const read=name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
function declarations(file,selector){
 const result={};
 postcss.parse(read(file)).walkRules(rule=>{if(rule.selectors.includes(selector))rule.walkDecls(d=>result[d.prop]=d.value);});
 return result;
}

test('standalone and embedded glossary use a bounded outer scrollport',()=>{
 const frame=declarations('workspace-launchers.css','.glossary-standalone');
 const scroll=declarations('workspace-launchers.css','.glossary-window-content');
 assert.equal(frame.height,'100dvh');assert.equal(frame.display,'flex');assert.equal(frame['flex-direction'],'column');assert.equal(frame.overflow,'hidden');
 assert.equal(scroll.flex,'1');assert.equal(scroll['min-height'],'0');assert.equal(scroll.overflow,'auto');assert.equal(scroll['overscroll-behavior'],'contain');
});

test('the natural-height glossary child cannot trap scroll chaining inside that outer scrollport',()=>{
 const selector='.glossary-window-content>.legal-glossary-panel';
 const fix=declarations('legal-glossary.css',selector);
 assert.equal(fix.overflow,'visible');assert.equal(fix['overscroll-behavior'],'auto');assert.equal(fix.flex,'none');assert.equal(fix.height,'auto');assert.equal(fix['max-height'],'none');
 // This two-class selector wins even when either single-class shared rule is loaded later.
 for(const file of ['review.css','review-mobile.css']){
  const shared=declarations(file,'.scroll-panel');assert.ok(shared.overflow);
  assert.ok(!Object.values(shared).some(value=>value.includes('!important')));
 }
 let conditional=false;
 postcss.parse(read('legal-glossary.css')).walkRules(rule=>{if(rule.selector===selector)conditional=rule.parent.type!=='root';});
 assert.equal(conditional,false,'the fix must apply at desktop, narrow iframe, and mobile widths');
});

test('the sidebar glossary retains its own bounded scroll area and wrapping rules',()=>{
 const side=declarations('four-pane.css','.four-pane-app .metadata-pane .scroll-panel');
 assert.equal(side.overflow,'auto');assert.equal(side['min-height'],'0');assert.equal(side.flex,'1');
 const text=declarations('legal-glossary.css','.glossary-entry h3');
 assert.equal(text['min-width'],'0');assert.equal(text['overflow-wrap'],'anywhere');
 const controls=declarations('legal-glossary.css','.glossary-filters select');
 assert.equal(controls.width,'100%');assert.equal(controls['min-width'],'0');
 assert.match(read('main.tsx'),/className="glossary-window-content"[^>]*tabIndex=\{0\}[^>]*role="region"[^>]*aria-label="법학어학사전 내용"/);
});

test('only title bars suppress touch panning; glossary content has no wheel interception',()=>{
 const popup=declarations('workspace-tool-popups.css','.workspace-tool-popup');
 const iframe=declarations('workspace-tool-popups.css','.workspace-tool-popup iframe');
 assert.equal(popup.overflow,'hidden');assert.equal(iframe.flex,'1');assert.equal(iframe['min-height'],'0');
 assert.equal(popup['touch-action'],undefined);assert.equal(iframe['touch-action'],undefined);
 assert.doesNotMatch(read('legal-glossary.tsx'),/onWheel|onTouchMove|addEventListener\(['"](?:wheel|touchmove)/);
 assert.match(read('legal-glossary.css'),/\.glossary-window-content:focus-visible\{outline:/);
});
