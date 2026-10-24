import React,{useEffect,useMemo,useRef,useState} from 'react';
import {dictionaryHref,exampleKindLabel,favoriteStorageKey,filterGlossary,glossarySearchText,languageLabels,normalizeLanguage,parseFavoriteIds,parseGlossary,selectSpeechVoice,speechLanguages,type GlossaryData,type GlossaryEntry,type GlossaryExample,type GlossaryLanguage,type GlossaryOrder} from './legal-glossary-model';
import './legal-glossary.css';

function usePronunciation(){
 const [voices,setVoices]=useState<SpeechSynthesisVoice[]>([]);
 const [speaking,setSpeaking]=useState<string|null>(null);
 const [message,setMessage]=useState('');
 const [phase,setPhase]=useState<'idle'|'preparing'|'playing'>('idle');
 const [voiceLabel,setVoiceLabel]=useState('');
 const serial=useRef(0);
 const activeId=useRef<string|null>(null);
 const utteranceRef=useRef<SpeechSynthesisUtterance|null>(null);
 const startTimer=useRef<number|null>(null);
 function clearStartTimer(){if(startTimer.current!==null){window.clearTimeout(startTimer.current);startTimer.current=null;}}
 useEffect(()=>{
  if(!('speechSynthesis' in window))return;
  const synth=window.speechSynthesis;
  const refresh=()=>setVoices(synth.getVoices());refresh();
  synth.addEventListener('voiceschanged',refresh);
  return()=>{serial.current++;activeId.current=null;utteranceRef.current=null;clearStartTimer();synth.removeEventListener('voiceschanged',refresh);synth.cancel();};
 },[]);
 function speak(entry:{id:string;text:string;language:GlossaryLanguage}){
  setMessage('');
  if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){setMessage('이 브라우저에서는 발음을 재생할 수 없습니다. 단어를 눌러 사전의 발음을 이용해 주세요.');return;}
  const synth=window.speechSynthesis;const stopping=activeId.current===entry.id;const run=++serial.current;clearStartTimer();synth.cancel();activeId.current=null;utteranceRef.current=null;setSpeaking(null);setPhase('idle');
  if(stopping)return;
  const voice=selectSpeechVoice(synth.getVoices().length?synth.getVoices():voices,entry.language);
  if(!voice){setMessage(`${languageLabels[entry.language]} 음성이 준비되어 있지 않습니다. 단어를 눌러 사전의 발음을 이용해 주세요.`);return;}
  const utterance=new SpeechSynthesisUtterance(entry.text);utterance.lang=speechLanguages[entry.language];utterance.voice=voice;utterance.rate=.88;
  activeId.current=entry.id;utteranceRef.current=utterance;setSpeaking(entry.id);setPhase('preparing');setVoiceLabel(voice.name||voice.lang);
  utterance.onstart=()=>{if(serial.current===run){clearStartTimer();setPhase('playing');}};
  utterance.onend=()=>{if(serial.current===run){clearStartTimer();activeId.current=null;utteranceRef.current=null;setSpeaking(null);setPhase('idle');}};
  utterance.onerror=event=>{if(serial.current!==run)return;clearStartTimer();activeId.current=null;utteranceRef.current=null;setSpeaking(null);setPhase('idle');setMessage(event.error==='canceled'||event.error==='interrupted'?'브라우저가 발음 재생을 중단했습니다. 다시 누르거나 단어를 눌러 사전의 발음을 이용해 주세요.':'발음을 재생하지 못했습니다. 단어를 눌러 사전의 발음을 이용해 주세요.');};
  try{
   startTimer.current=window.setTimeout(()=>{if(serial.current!==run)return;serial.current++;startTimer.current=null;activeId.current=null;utteranceRef.current=null;setSpeaking(null);setPhase('idle');synth.cancel();setMessage('발음 재생이 시작되지 않았습니다. 다시 누르거나 단어를 눌러 사전의 발음을 이용해 주세요.');},10000);
   synth.speak(utterance);
  }catch{clearStartTimer();activeId.current=null;utteranceRef.current=null;setSpeaking(null);setPhase('idle');setMessage('발음을 재생하지 못했습니다. 단어를 눌러 사전의 발음을 이용해 주세요.');}
 }
 function stop(){serial.current++;clearStartTimer();activeId.current=null;utteranceRef.current=null;setSpeaking(null);setPhase('idle');if('speechSynthesis' in window)window.speechSynthesis.cancel();}
 return{speaking,message,phase,voiceLabel,speak,stop};
}

function Entry({entry,examples,sourceNames,favorite,onFavorite,speakingId,onSpeak}:{entry:GlossaryEntry;examples:GlossaryExample[];sourceNames:Map<string,string>;favorite:boolean;onFavorite:()=>void;speakingId:string|null;onSpeak:(value:{id:string;text:string;language:GlossaryLanguage})=>void}){
 const [shown,setShown]=useState(8);
 const [shownExamples,setShownExamples]=useState(1);
 const gloss=[entry.pronunciation,entry.meaning].filter(Boolean).join(', ');
 const speaking=speakingId===`term:${entry.id}`;
 return <article className="glossary-entry">
  <div className="glossary-entry-line">
   <button type="button" className={`glossary-speak${speaking?' is-speaking':''}`} onClick={()=>onSpeak({id:`term:${entry.id}`,text:entry.term,language:entry.language})} aria-label={`${entry.term} ${languageLabels[entry.language]} 발음 ${speaking?'중지':'듣기'}`} title={`${languageLabels[entry.language]} 발음 ${speaking?'중지':'듣기'}`}><span aria-hidden="true">{speaking?'◉':'🔊'}</span></button>
   <h3><a href={dictionaryHref(entry)} target="_blank" rel="noopener noreferrer" lang={speechLanguages[entry.language]} aria-label={`${entry.term} 외부 사전에서 보기 (새 창)`}>{entry.term}</a>{gloss&&<span className="glossary-gloss">, {gloss}</span>}</h3>
   <button type="button" className="glossary-favorite" aria-pressed={favorite} onClick={onFavorite} aria-label={`${entry.term} 즐겨찾기 ${favorite?'해제':'추가'}`} title={`즐겨찾기 ${favorite?'해제':'추가'}`}><span aria-hidden="true">{favorite?'★':'☆'}</span></button>
  </div>
  {examples.slice(0,shownExamples).map(example=><div className="glossary-example" key={example.id}>
   <span className="glossary-example-kind">{exampleKindLabel(example.kind)}</span>
   <div className="glossary-example-original"><button type="button" className={`glossary-speak${speakingId===`example:${entry.id}:${example.id}`?' is-speaking':''}`} onClick={()=>onSpeak({id:`example:${entry.id}:${example.id}`,text:example.text,language:example.language})} aria-label={`${entry.term} ${exampleKindLabel(example.kind)} ${languageLabels[example.language]} 발음 ${speakingId===`example:${entry.id}:${example.id}`?'중지':'듣기'}`}><span aria-hidden="true">{speakingId===`example:${entry.id}:${example.id}`?'◉':'🔊'}</span></button><p lang={speechLanguages[example.language]}>{example.text}</p></div>
   {example.translation&&<p className="glossary-example-translation">{example.translation}</p>}
   {example.href&&<a className="glossary-example-source" href={example.href} target="_blank" rel="noopener noreferrer">{example.label||sourceNames.get(example.sourceId)||example.sourceId} ↗</a>}
   {!!example.editorialNotes?.length&&<details className="glossary-editorial-notes"><summary>원문 표시 안내</summary><ul>{example.editorialNotes.map((note,i)=><li key={i}>{note}</li>)}</ul></details>}
  </div>)}
  {examples.length>shownExamples&&<button type="button" className="glossary-more-examples" onClick={()=>setShownExamples(v=>v+1)}>다른 원문 보기 ({shownExamples}/{examples.length})</button>}
  <div className="glossary-meta"><span>{languageLabels[entry.language]}</span>{entry.partOfSpeech&&<span>{entry.partOfSpeech}</span>}<span>출현 {entry.frequency.toLocaleString('ko-KR')}회</span></div>
  <details className="glossary-detail"><summary>법학 뜻·원문 보기</summary>
   {entry.legalMeaning&&<p><strong>법학 뜻</strong> {entry.legalMeaning}</p>}
   {entry.lemma!==entry.term&&<p><strong>기본형</strong> <span lang={speechLanguages[entry.language]}>{entry.lemma}</span></p>}
   {entry.grammaticalNote&&<p><strong>형태 설명</strong> {entry.grammaticalNote}</p>}
   {!!entry.forms?.length&&<p><strong>문헌에 나온 형태</strong> <span lang={speechLanguages[entry.language]}>{entry.forms.join(', ')}</span></p>}
   <ul className="glossary-occurrences">{entry.occurrences.slice(0,shown).map((o,i)=><li key={`${o.sourceId}-${o.page??''}-${i}`}>
    {o.href?<a href={o.href} target="_blank" rel="noopener noreferrer">{o.label||sourceNames.get(o.sourceId)||o.sourceId}<span aria-hidden="true"> ↗</span></a>:<span>{o.label||sourceNames.get(o.sourceId)||o.sourceId}</span>}
    {o.context&&<p lang={speechLanguages[entry.language]}>{o.context}</p>}
   </li>)}</ul>
   {entry.occurrences.length>shown&&<button type="button" className="glossary-more-context" onClick={()=>setShown(n=>n+8)}>원문 위치 8개 더 보기 ({shown}/{entry.occurrences.length})</button>}
  </details>
 </article>;
}

export default function LegalGlossary(){
 const [data,setData]=useState<GlossaryData|null>(null);const [error,setError]=useState(false);const [reload,setReload]=useState(0);
 const [query,setQuery]=useState('');const [language,setLanguage]=useState('all');const [source,setSource]=useState('all');const [order,setOrder]=useState<GlossaryOrder>('importance');const [onlyImportant,setOnlyImportant]=useState(false);const [onlyFavorites,setOnlyFavorites]=useState(false);const [favorites,setFavorites]=useState<Set<string>>(new Set());const [limit,setLimit]=useState(50);const [storageMessage,setStorageMessage]=useState('');
 const pronunciation=usePronunciation();
 useEffect(()=>{const abort=new AbortController();setError(false);setData(null);
  fetch('./legal-glossary265.json',{signal:abort.signal}).then(response=>{if(!response.ok)throw new Error('fetch');return response.json();}).then(raw=>{const parsed=parseGlossary(raw);if(abort.signal.aborted)return;setData(parsed);try{setFavorites(parseFavoriteIds(localStorage.getItem(favoriteStorageKey(parsed.version)),parsed.entries));}catch{setFavorites(new Set());setStorageMessage('이 브라우저에서는 즐겨찾기를 저장할 수 없습니다. 현재 화면에서는 사용할 수 있습니다.');}}).catch(()=>{if(!abort.signal.aborted)setError(true);});
  return()=>abort.abort();
 },[reload]);
 useEffect(()=>setLimit(50),[query,language,source,order,onlyFavorites,onlyImportant]);
 const searchIndex=useMemo(()=>new Map(data?.entries.map(e=>[e.id,glossarySearchText(e)])??[]),[data]);
 const sourceNames=useMemo(()=>new Map(data?.sources.map(s=>[s.id,s.title])??[]),[data]);
 const exampleMap=useMemo(()=>new Map(data?.examples.map(e=>[e.id,e])??[]),[data]);
 const filtered=useMemo(()=>data?filterGlossary(data.entries,{query,language,source,order,onlyFavorites,onlyImportant,favorites},searchIndex):[],[data,query,language,source,order,onlyFavorites,onlyImportant,favorites,searchIndex]);
 const sourceOptions=data?.sources.filter(s=>language==='all'||normalizeLanguage(s.language)===language||data.entries.some(e=>e.language===language&&(e.sourceIds??e.occurrences.map(o=>o.sourceId)).includes(s.id)))??[];
 function toggleFavorite(id:string){if(!data)return;const next=new Set(favorites);next.has(id)?next.delete(id):next.add(id);setFavorites(next);try{localStorage.setItem(favoriteStorageKey(data.version),JSON.stringify([...next]));setStorageMessage('');}catch{setStorageMessage('즐겨찾기를 저장하지 못했습니다. 현재 화면에서는 사용할 수 있습니다.');}}
 function clearFilters(){setQuery('');setLanguage('all');setSource('all');setOnlyFavorites(false);setOnlyImportant(false);}
 return <section className="scroll-panel legal-glossary-panel" aria-labelledby="legal-glossary-title">
  <div className="panel-heading"><span className="section-eyebrow">법학 어학사전</span><h2 id="legal-glossary-title">원문을 읽는 데 필요한 단어</h2><p>논문에서 인용한 외국 문헌의 단어를 찾아보고, 원문에서 쓰인 자리로 이동할 수 있습니다.</p></div>
  <p className="glossary-note">한글 발음은 읽기를 돕는 약식 표기입니다. 스피커는 브라우저 합성음성으로 읽으며, 단어를 누르면 외부 사전이 열립니다.</p>
  {!data&&!error&&<p role="status">사전을 불러오는 중입니다.</p>}
  {error&&<div className="glossary-empty" role="alert"><p>사전을 불러오지 못했습니다.</p><button type="button" onClick={()=>setReload(v=>v+1)}>다시 불러오기</button></div>}
  {data&&<>
   <div className="glossary-filters">
    <label className="glossary-search">단어·발음·뜻 검색<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="예: discharge, 인졸벤츠, 보증금"/></label>
    <label>언어<select value={language} onChange={e=>{setLanguage(e.target.value);setSource('all');}}><option value="all">전체 언어</option>{(Object.keys(languageLabels) as GlossaryLanguage[]).map(l=><option value={l} key={l}>{languageLabels[l]}</option>)}</select></label>
    <label>문헌<select value={source} onChange={e=>setSource(e.target.value)}><option value="all">전체 문헌</option>{sourceOptions.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
    <label>정렬<select value={order} onChange={e=>setOrder(e.target.value as GlossaryOrder)}><option value="importance">중요 법률 명사순</option><option value="frequency">자주 나온 순</option><option value="alphabet">가나다·ABC 순</option></select></label>
   </div>
   <div className="glossary-options"><label><input type="checkbox" checked={onlyImportant} onChange={e=>setOnlyImportant(e.target.checked)}/> 중요 법률 명사만 보기</label><label><input type="checkbox" checked={onlyFavorites} onChange={e=>setOnlyFavorites(e.target.checked)}/> 즐겨찾기만 보기</label><button type="button" onClick={clearFilters}>검색 초기화</button></div>
   {order==='importance'&&<details className="glossary-voice-info"><summary>중요도 정렬 기준</summary><p>문헌에 실제 나온 도산·채권·집행의 핵심 명사, 법학 뜻이 있는 명사와 법률복합어, 그 밖의 명사를 먼저 보여 줍니다. 같은 중요도에서는 영어·독일어·일본어를 번갈아 배치하며, 각 언어 안에서는 자주 나온 순으로 정렬합니다. 관사·전치사·조사 등은 뒤에 둡니다.</p></details>}
   <p className="glossary-count" role="status">전체 {data.entries.length.toLocaleString('ko-KR')}개 중 {filtered.length.toLocaleString('ko-KR')}개</p>
   {storageMessage&&<p className="glossary-note" role="status">{storageMessage}</p>}
   {pronunciation.message&&<p className="glossary-audio-message" role="status">{pronunciation.message}</p>}
   {pronunciation.speaking&&<div className="glossary-audio-controls"><span role="status">{pronunciation.phase==='playing'?'발음 재생 중':'발음 준비 중'}</span><button type="button" onClick={pronunciation.stop}>발음 중지</button></div>}
   {pronunciation.voiceLabel&&<details className="glossary-voice-info"><summary>발음 정보</summary><p>선택 음성: {pronunciation.voiceLabel}</p><p>{pronunciation.phase==='playing'?'브라우저가 재생 시작을 알렸습니다.':pronunciation.phase==='preparing'?'브라우저의 재생 시작을 기다리고 있습니다.':'현재 발음을 재생하고 있지 않습니다.'}</p></details>}
   {filtered.length?<div className="glossary-list">{filtered.slice(0,limit).map(entry=><Entry key={entry.id} entry={entry} examples={(entry.exampleIds??[]).map(id=>exampleMap.get(id)).filter((e):e is GlossaryExample=>!!e)} sourceNames={sourceNames} favorite={favorites.has(entry.id)} onFavorite={()=>toggleFavorite(entry.id)} speakingId={pronunciation.speaking} onSpeak={pronunciation.speak}/>)}</div>:<div className="glossary-empty"><p>{onlyFavorites?'조건에 맞는 즐겨찾기가 없습니다.':'조건에 맞는 단어가 없습니다.'}</p><button type="button" onClick={clearFilters}>전체 단어 보기</button></div>}
   {filtered.length>limit&&<button type="button" className="glossary-load-more" onClick={()=>setLimit(n=>n+50)}>50개 더 보기 ({Math.min(limit,filtered.length).toLocaleString('ko-KR')}/{filtered.length.toLocaleString('ko-KR')})</button>}
   <details className="glossary-source-list"><summary>수록 문헌과 범위</summary>{data.scope&&<p>{data.scope}</p>}<ul>{data.sources.map(s=><li key={s.id}>{s.href?<a href={s.href} target="_blank" rel="noopener noreferrer">{s.title} ↗</a>:s.title}{s.scope&&<p>{s.scope}</p>}</li>)}</ul></details>
  </>}
 </section>;
}
