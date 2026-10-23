import React from 'react';
import projectLinks from './project-links.json';
import './profile-row.css';

type ProfileEntry = Record<string, string | undefined>;

export default function ProfileRow({section, row}: {section: string; row: ProfileEntry}) {
  const financialQualification = section === 'qualifications' && row.name === '금융파산전문가' && row.detail === '예금보험공사';
  const name = financialQualification ? '금융파산전문가(예금보험공사)' : (row.institution || row.organization || row.name || '').replaceAll('LAW IN US', 'LAWINUS');
  const period = row.period && /^\d{4}\.\s*\d{1,2}\.$/.test(row.period) ? `${row.period} 취임` : row.period;
  const date = section === 'service' ? '' : row.year || period || row.date || '';
  const detail = [row.role, row.degree, row.field, financialQualification ? undefined : row.detail].filter(Boolean).join(' · ');
  const url = section === 'projects' ? (projectLinks as Record<string, string>)[name] : undefined;
  const contents = section === 'professionalActivities'
    ? <span className="profile-inline"><b>{name}</b>{detail && ` ${detail}`}</span>
    : <><b>{name}</b>{detail && <p>{detail}</p>}</>;

  return <div className={`profile-row${date ? '' : ' undated'}`}>
    {date && <span>{date}</span>}
    {url ? <a className="profile-project-link" href={url} target="_blank" rel="noopener noreferrer"
      title="새 창에서 열기" aria-label={`${name}${detail ? ` — ${detail}` : ''} (새 창에서 열기)`}>
      <div>{contents}</div><span className="project-link-arrow" aria-hidden="true">↗</span>
    </a> : <div>{contents}</div>}
  </div>;
}
