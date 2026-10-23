import React from 'react';
import ProfileRow from './profile-row';
import press from './press-coverage.json';
import ResearchAchievements from './research-achievements';
import './profile-sections.css';

type Entry = Record<string, string | undefined>;
type Profile = Record<string, any> | null;

export default function ProfileSections({profile}: {profile: Profile}) {
  const sections = [
    ['education','학력'], ['experience','주요 경력'], ['awards','수상'],
    ['research','연구업적'], ['projects','주요 작품'], ['press','언론'],
    ['service','공익·자문 활동(역임 포함)'],
    ['professionalActivities','학회·전문단체 활동(역임 포함)'],
    ['qualifications','자격·전문 등록']
  ];
  const book: Entry = {name:'대한민국 표준판례 5급편', role:'헌법·민법·형법 50판례 · 저자 김민규', detail:'PDF'};

  return <>{sections.map(([key,title]) => {
    if (key === 'research') return <ResearchAchievements key={key}/>;
    if (key === 'press') return <section key={key} className="profile-press" aria-labelledby="profile-press-title">
      <h3 id="profile-press-title">{title}</h3>
      <ul className="profile-press-list">{press.map(item => <li key={item.url}>
        <a className="profile-press-link" href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`${item.title} (새 창에서 열기)`}>
          <span className="press-meta"><span>{item.publisher}</span><time dateTime={item.date}>{item.date.replaceAll('-','.')}</time><span className="press-kind">{item.kind}</span></span>
          <span className="press-title">{item.title}<span aria-hidden="true"> ↗</span></span>
          <span className="press-summary">{item.summary}</span>
        </a>
      </li>)}</ul>
    </section>;
    const rows: Entry[] = (profile?.[key] || []).filter((row: Entry) => key !== 'qualifications' || row.name !== '세무대리 등록');
    if (key === 'projects' && !rows.some(row => row.name === book.name)) rows.push(book);
    return <section key={key}><h3>{title}</h3>{rows.map((row,i) => <ProfileRow key={i} section={key} row={row}/>)}</section>;
  })}</>;
}
