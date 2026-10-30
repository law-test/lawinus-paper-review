import React from 'react';
import inspection from './inspection-record.json';

export default function InspectionRecord(){
 return <details className="revision-context-note"><summary>AI생성검사 기록</summary>
  <p>사용자가 제공한 v120 검사결과입니다. 입력 형식별 결과를 따로 표시합니다.</p>
  {inspection.reports.map(report=><p key={report.report_number}>v120 {report.input_format}: AI 의심률 {report.ai_percent}% · {report.total_regions}영역 중 의심 {report.suspected_regions}영역(모두 낮음). {report.examined_at} 검사, 보고서 {report.report_number}.</p>)}
  <p>이전 80차 단락재조정 PDF는 11%였습니다(2026. 10. 29. 16:33 검사, 400영역 중 낮음 61영역). 형식과 판본이 다른 검사값의 차이를 문체교정 효과로 단정하지 않습니다.</p>
  <p>v121·v122·v123은 아직 재검사하지 않았으며 5% 이하 달성 여부도 확인되지 않았습니다.</p>
 </details>;
}
