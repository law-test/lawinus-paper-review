import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseEvidenceDocument,sha256Text,verifiedEvidence} from '../src/source-evidence.ts';
const base=new URL('../public/editions/human80/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',base),'utf8'));
const raw=JSON.parse(fs.readFileSync(new URL('source-evidence.json',base),'utf8'));
const evidence=parseEvidenceDocument(raw);
test('all published entries pass the strict schema and contain coordinates rather than audit commentary',()=>{
 assert.ok(evidence.entries.length>0);assert.equal(evidence.entries.length,raw.entries.length);
 const allowed=new Set(['id','noteId','sourceId','status','kind','sourceSha256','noteTextSha256','page','printedPage','pageWidth','pageHeight','rects','start','end','textSha256']);
 for(const row of raw.entries){assert.equal(row.status,'verified');for(const key of Object.keys(row))assert.ok(allowed.has(key),`unexpected public field ${key}`);}
});
test('every verified passage links an existing human80 note to its own permitted source and exact text hash',async()=>{
 assert.equal(manifest.notes.length,444);assert.equal(manifest.sources.length,210);
 for(const row of evidence.entries){
  const note=manifest.notes.find(n=>n.id===row.noteId),source=manifest.sources.find(s=>s.id===row.sourceId);
  assert.ok(note,`${row.id} note`);assert.ok(source,`${row.id} source`);
  assert.ok(note.sourceRefs.some(ref=>ref.sourceId===row.sourceId),`${row.id} note-source link`);
  assert.equal(row.noteTextSha256,await sha256Text(note.text),`${row.id} note hash`);
  assert.equal(row.kind,source.kind,`${row.id} file kind`);
  assert.ok(verifiedEvidence(evidence,note,source,row.noteTextSha256).some(e=>e.id===row.id),`${row.id} eligible`);
 }
});
test('one permitted source does not mix file versions across different notes',()=>{
 const bySource=new Map();
 for(const row of evidence.entries){const old=bySource.get(row.sourceId);if(old)assert.equal(old,row.sourceSha256,row.sourceId);bySource.set(row.sourceId,row.sourceSha256);}
});
