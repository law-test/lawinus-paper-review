import test from 'node:test';
import assert from 'node:assert/strict';
import {parseEvidenceDocument,sourceNotes,sourceNoteId,verifiedEvidence,evidenceHighlights,matchesEvidencePage,evidenceRectStyle,documentEvidenceMatches,sha256Text,textEvidenceParts,verifiedTextEvidence} from '../src/source-evidence.ts';
const noteHash='a'.repeat(64),sourceHash='b'.repeat(64);
const note={id:'fn-001',number:1,text:'인간80 각주',sourceRefs:[{sourceId:'source-a',targetPage:2}]};
const source={id:'source-a',kind:'pdf',pages:12};
const row={id:'ev-1',noteId:note.id,sourceId:source.id,status:'verified',kind:'pdf',noteTextSha256:noteHash,sourceSha256:sourceHash,page:2,printedPage:'104',pageWidth:600,pageHeight:800,rects:[[60,160,300,180],[60,180,180,200]]};
const doc=(entries=[row])=>parseEvidenceDocument({version:1,edition:'human80',entries});
test('only the human80 edition is accepted',()=>assert.throws(()=>parseEvidenceDocument({version:1,edition:'other-edition',entries:[row]})));
test('unknown or unrelated selection cannot borrow another note context',()=>{
 const other={...note,id:'fn-002',sourceRefs:[{sourceId:'source-b'}]};
 assert.equal(sourceNoteId([note,other],source.id,'fn-002'),null);
 assert.equal(sourceNoteId([note,other],source.id,null),null);
 assert.equal(sourceNoteId([note,other],source.id,note.id),note.id);
 assert.deepEqual(sourceNotes([note,other],source.id),[note]);
 assert.deepEqual(verifiedEvidence(doc(),other,source,noteHash),[]);
});
test('only exact note, source, version hash, and verified evidence creates geometry',()=>{
 assert.equal(verifiedEvidence(doc(),note,source,noteHash).length,1);
 assert.deepEqual(verifiedEvidence(doc(),note,source,'c'.repeat(64)),[]);
 assert.deepEqual(verifiedEvidence(doc(),note,{...source,id:'source-b'},noteHash),[]);
 assert.deepEqual(verifiedEvidence(doc([{...row,status:'unverified'}]),note,source,noteHash),[]);
 assert.deepEqual(verifiedEvidence(doc(),note,{...source,pages:1},noteHash),[]);
});
test('conflicting source byte hashes are withheld instead of mixed',()=>assert.deepEqual(verifiedEvidence(doc([row,{...row,id:'ev-2',sourceSha256:'d'.repeat(64)}]),note,source,noteHash),[]));
test('malformed rectangles, missing hashes and duplicate IDs do not create highlights',()=>{
 assert.equal(doc([row,row]).entries.length,1);
 for(const change of [{rects:[[0,0,800,900]]},{rects:[[20,30,10,40]]},{rects:[[0,NaN,20,30]]},{page:0},{sourceSha256:''},{noteTextSha256:''}])assert.equal(doc([{...row,...change}]).entries.length,0);
});
test('each source line remains a separate highlight and page coordinates scale proportionally',()=>{
 const lines=evidenceHighlights(doc().entries);assert.equal(lines.length,2);assert.deepEqual(lines[0].rect,[60,160,300,180]);
 const style=evidenceRectStyle(lines[0].rect,{width:600,height:800});assert.deepEqual(style,{left:'10%',top:'20%',width:'40%',height:'2.5%'});
 for(const screenWidth of [300,600,1200]){assert.equal(parseFloat(style.left)/100*screenWidth,screenWidth*.1);assert.equal(parseFloat(style.width)/100*screenWidth,screenWidth*.4);}
 assert.equal(matchesEvidencePage(lines[0],{width:600,height:800}),true);
 assert.equal(matchesEvidencePage(lines[0],{width:595,height:842}),false);
});
test('the actually loaded PDF object and bytes must both match before any mark appears',()=>{
 const pdf={},oldPdf={};assert.equal(documentEvidenceMatches(sourceHash,null,pdf),false);
 assert.equal(documentEvidenceMatches(sourceHash,{doc:oldPdf,checksum:sourceHash},pdf),false);
 assert.equal(documentEvidenceMatches(sourceHash,{doc:pdf,checksum:noteHash},pdf),false);
 assert.equal(documentEvidenceMatches(sourceHash,{doc:pdf,checksum:sourceHash},pdf),true);
 assert.equal(documentEvidenceMatches(undefined,{doc:pdf,checksum:sourceHash},pdf),false);
});
test('text offsets preserve exact Unicode text and reject a mismatching quoted passage',async()=>{
 const text='앞문장. 😀 인용 근거. 뒷문장.';const start=text.indexOf('인용'),end=start+'인용 근거'.length;
 const entry={id:'ev-text',noteId:note.id,sourceId:source.id,status:'verified',kind:'text',sourceSha256:sourceHash,noteTextSha256:noteHash,textSha256:await sha256Text(text),start,end};
 const parsed=doc([entry]);assert.equal(parsed.entries.length,1);
 const parts=textEvidenceParts(text,parsed.entries);assert.equal(parts.map(x=>x.text).join(''),text);assert.deepEqual(parts.filter(x=>x.highlighted).map(x=>x.text),['인용 근거']);
 assert.equal(textEvidenceParts(text,[{...entry,quote:'다른 문구'}]).filter(x=>x.highlighted).length,0);
 assert.equal(textEvidenceParts(text,[{...entry,end:999}]).filter(x=>x.highlighted).length,0);
 assert.equal(doc([{...entry,textSha256:undefined}]).entries.length,0);
 assert.equal(verifiedTextEvidence(parsed.entries,text,sourceHash,entry.textSha256).length,1);
 assert.equal(verifiedTextEvidence(parsed.entries,text,noteHash,entry.textSha256).length,0);
 assert.equal(verifiedTextEvidence(parsed.entries,text,sourceHash,noteHash).length,0);
 assert.equal(verifiedTextEvidence([{...entry,end:999}],text,sourceHash,entry.textSha256).length,0);
});
