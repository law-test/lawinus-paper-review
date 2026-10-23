import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_READING_VIEW,readingVisibility,readingPane,withReadingFocus,withReadingSurface} from '../src/reading-view.ts';

test('reading focus hides surrounding panels without changing the saved normal view',()=>{
 const normal={...DEFAULT_READING_VIEW,focus:false,header:false,footnotes:false};
 const focused=withReadingFocus(normal,true);
 assert.deepEqual(readingVisibility(focused,true,true),{header:false,tools:false,footnotes:false,sidebar:false,metadata:false});
 assert.deepEqual(withReadingFocus(focused,false),normal);
 assert.deepEqual(readingVisibility(normal,false,true),{header:false,tools:true,footnotes:false,sidebar:false,metadata:true});
 assert.equal(DEFAULT_READING_VIEW.focus,true);
});
test('focus always shows a document on mobile and normal mode restores the selected panel',()=>{
 const focused=withReadingFocus(DEFAULT_READING_VIEW,true);
 for(const pane of ['contents','metadata','thesis'])assert.equal(readingPane(focused,pane),'thesis');
 assert.equal(readingPane(focused,'source'),'source');
 const normal=withReadingFocus(DEFAULT_READING_VIEW,false);
 assert.equal(readingPane(normal,'metadata'),'metadata');
 assert.equal(readingPane(normal,'contents'),'contents');
});
test('large-view checkboxes can restore individual panels without overwriting normal choices',()=>{
 const normal={focus:false,header:true,tools:false,footnotes:true};
 let view=withReadingFocus(normal,true);
 view=withReadingSurface(view,'sidebar',true);
 view=withReadingSurface(view,'metadata',true);
 view=withReadingSurface(view,'tools',true);
 assert.deepEqual(readingVisibility(view,false,false),{header:false,tools:true,footnotes:false,sidebar:true,metadata:true});
 assert.equal(readingPane(view,'contents'),'contents');
 assert.equal(readingPane(view,'metadata'),'metadata');
 assert.deepEqual(withReadingFocus(view,false),normal);
 const freshFocus=withReadingFocus(withReadingFocus(view,false),true);
 assert.deepEqual(readingVisibility(freshFocus,true,true),{header:false,tools:false,footnotes:false,sidebar:false,metadata:false});
 assert.deepEqual(readingVisibility(withReadingFocus(view,false),false,false),{header:true,tools:false,footnotes:true,sidebar:false,metadata:false});
 view=withReadingSurface(view,'sidebar',false);
 assert.equal(readingPane(view,'contents'),'thesis');
 assert.equal(readingVisibility(view,true,true).sidebar,false);
});
