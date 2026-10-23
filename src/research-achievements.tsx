import React from 'react';
import groups from './research-achievements.json';

type ResearchItem = {title: string; publication: string; authors?: string; role?: string; url?: string};

export default function ResearchAchievements() {
  return <section className="profile-research" aria-labelledby="profile-research-title">
    <h3 id="profile-research-title">연구업적</h3>
    {groups.map(group => <div className="research-group" key={group.title}>
      <h4>{group.title}</h4>
      <ul className="research-list">{group.items.map((item: ResearchItem) => <li key={item.title}>
        {item.url ? <a className="research-title" href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`${item.title} (새 창에서 열기)`}>{item.title}<span aria-hidden="true"> ↗</span></a>
          : <span className="research-title">{item.title}</span>}
        <p>{[item.publication,item.authors,item.role].filter(Boolean).join(' · ')}</p>
      </li>)}</ul>
    </div>)}
    <div className="research-group profile-patents">
      <h4>특허 출원</h4>
      <div className="profile-patent"><b>인공지능 활용 법학 판례집 단계별 편성 및 개정 동기화 기기</b>
        <dl><div><dt>출원번호</dt><dd>10-2026-0191635</dd></div><div><dt>출원일</dt><dd>2026.10.06.</dd></div><div><dt>출원인</dt><dd>김민규</dd></div></dl>
      </div>
    </div>
  </section>;
}
