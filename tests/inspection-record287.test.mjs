import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectionLevels} from '../src/inspection-record-model.ts';

const inspection=JSON.parse(readFileSync(new URL('../src/inspection-record.json',import.meta.url),'utf8'));
test('v126 HWPX keeps the medium finding separate from low findings',()=>{
 const report=inspection.reports.find(r=>r.report_number==='00380083155');
 assert.equal(report.edition,'v126');assert.equal(report.input_format,'HWPX');
 assert.equal(report.ai_percent,30);assert.equal(report.total_regions,194);assert.equal(report.suspected_regions,97);
 assert.equal(inspectionLevels(report),'높음 0·중간 1·낮음 96');
});
test('v126 PDF preserves its own input, score and suspicion counts',()=>{
 const report=inspection.reports.find(r=>r.report_number==='00380083164');
 assert.equal(report.edition,'v126');assert.equal(report.input_format,'PDF');
 assert.equal(report.ai_percent,10);assert.equal(report.total_regions,302);assert.equal(report.suspected_regions,29);
 assert.equal(inspectionLevels(report),'높음 0·중간 0·낮음 29');
});
test('no result is attributed to untested v129 or to plagiarism',()=>{
 assert.equal(inspection.v126Tested,true);assert.equal(inspection.v129Tested,false);
 assert.equal(inspection.fivePercentTargetVerified,false);
 assert.equal(inspection.reports.filter(r=>r.edition==='v129').length,0);
 const component=readFileSync(new URL('../src/inspection-record.tsx',import.meta.url),'utf8');
 assert.ok(component.includes('inspectionLevels(report)'));
 assert.ok(!component.includes('(모두 낮음)'));
 assert.ok(component.includes('일반 표절률과 구별'));
});
