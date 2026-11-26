'use client';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {Suspense,useEffect,useRef,useState} from 'react';
import type {Cue} from '../subtitles';

function videoId(input:string) {
  try {
    const url=new URL(input);
    if(!['http:','https:'].includes(url.protocol)) return '';
    const host=url.hostname.toLowerCase();
    const path=url.pathname.split('/').filter(Boolean);
    const id=host==='youtu.be'?path[0]:['youtube.com','www.youtube.com','m.youtube.com'].includes(host)?
      (url.pathname==='/watch'?url.searchParams.get('v'):['shorts','live','embed'].includes(path[0])?path[1]:null):null;
    return id && /^[\w-]{11}$/.test(id)?id:'';
  }catch{return '';}
}
function validCues(data:unknown):data is Cue[]{
  return Array.isArray(data) && data.length>0 && data.length<=100000 && data.every(c=>c && Number.isFinite(c.start) && c.start>=0 && Number.isFinite(c.end) && c.end>c.start && typeof c.text==='string');
}
export default function Extractor() {
  return <Suspense><ExtractorForm /></Suspense>;
}
function ExtractorForm() {
  const params=useSearchParams();
  const [input,setInput]=useState(()=>{
    const initial=params.get('v');
    return initial && /^[\w-]{11}$/.test(initial) ? 'https://www.youtube.com/watch?v='+initial : '';
  });
  const [id,setId]=useState('');
  const [cues,setCues]=useState<Cue[]>([]);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [fallback,setFallback]=useState(false);
  const [bookmark,setBookmark]=useState('');
  const [showCode,setShowCode]=useState(false);
  const child=useRef<Window|null>(null);
  const sequence=useRef(0);
  useEffect(()=>{
    fetch('/capture-transcript.js').then(r=>{if(!r.ok)throw Error();return r.text();}).then(js=>{
      setBookmark('javascript:'+encodeURIComponent(js.replace("'__EXTRACTOR_ORIGIN__'",JSON.stringify(location.origin))));
    }).catch(()=>setStatus('The capture bookmark could not load. Refresh to retry.'));
  },[]);
  useEffect(()=>{
    function receive(e:MessageEvent){
      if(!['https://www.youtube.com','https://m.youtube.com','https://youtube.com'].includes(e.origin) || !child.current || e.source!==child.current ||
        e.data?.type!=='mabel-transcript' || e.data.id!==id || !validCues(e.data.cues)) return;
      setCues(e.data.cues);setStatus(e.data.cues.length+' timed lines extracted from YouTube.');setFallback(false);
      child.current.postMessage({type:'mabel-transcript-saved',id},e.origin);
    }
    window.addEventListener('message',receive);return ()=>window.removeEventListener('message',receive);
  },[id]);
  async function extract() {
    const key=++sequence.current;
    const next=videoId(input.trim());
    setCues([]);setId(next);setFallback(false);child.current=null;
    if(!next){setStatus('Paste a YouTube video link.');return;}
    setBusy(true);setStatus('Checking for a public caption track…');
    try{
      const r=await fetch('/api/youtube-captions?videoId='+next);
      if(!r.ok)throw Error();
      const result=await r.json() as {cues:Cue[]};
      if(!validCues(result.cues))throw Error();
      if(key===sequence.current){setCues(result.cues);setStatus(result.cues.length+' timed lines extracted.');}
    }catch{if(key===sequence.current){setFallback(true);setStatus('Direct download unavailable. Capture the transcript from the YouTube page below.');}}
    finally{if(key===sequence.current)setBusy(false);}
  }
  function save() {
    const stamp=(t:number)=>new Date(Math.floor(t*1000)).toISOString().slice(11,23).replace('.',',');
    const text=cues.map((c,i)=>(i+1)+'\n'+stamp(c.start)+' --> '+stamp(c.end)+'\n'+c.text+'\n').join('\n');
    const url=URL.createObjectURL(new Blob([text],{type:'application/x-subrip;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=id+'.srt';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  return <main className="start-screen"><section className="start-content scene-panel">
    <p className="eyebrow">Mabel Movie Companion</p><h1>Transcript extractor</h1>
    <form className="fields" onSubmit={e=>{e.preventDefault();void extract();}}>
      <label>YouTube link<input type="url" required value={input} onChange={e=>{sequence.current++;setInput(e.target.value);setBusy(false);setId('');setCues([]);setFallback(false);setStatus('');}} placeholder="Paste a video link"/></label>
      <div className="transport"><button className="primary" disabled={busy}>Extract transcript</button></div>
    </form>
    <p role="status">{status}</p>
    {fallback && <section><h2>Capture on YouTube</h2><p>Save the capture bookmark once. Open this video in your browser and run the bookmark on the YouTube page.</p>
      <details><summary>Set up the bookmark on a tablet</summary><ol><li>Copy the bookmark address below.</li><li>Bookmark this page. Edit that bookmark, name it <strong>Extract transcript</strong>, and replace its URL with the copied address.</li><li>On the YouTube watch page, type <strong>Extract transcript</strong> into the address bar and tap the saved bookmark suggestion.</li></ol>
      <div className="transport"><button disabled={!bookmark} onClick={async()=>{try{await navigator.clipboard.writeText(bookmark);setStatus('Bookmark address copied.');}catch{setShowCode(true);}}}>Copy bookmark address</button></div>
      {showCode && <textarea readOnly aria-label="Bookmark address" value={bookmark} onFocus={e=>e.target.select()}/>}</details>
      <div className="transport"><button className="primary" onClick={()=>{child.current=window.open('https://www.youtube.com/watch?v='+id,'_blank');}}>Open video on YouTube</button></div>
      <p>The bookmark returns the lines here or downloads an SRT if the browser separates the tabs. Use your browser’s Desktop site option if the mobile transcript panel is unavailable.</p></section>}
    {cues.length>0 && <div className="transport"><button className="primary" onClick={()=>{
      try {sessionStorage.setItem('extractor:'+id,JSON.stringify(cues));location.assign('/?watch='+id);}catch{setStatus('Browser storage is full. Download the SRT instead.');}
    }}>Use in companion</button><button onClick={save}>Download SRT</button></div>}
    <p><Link href="/">Back to movie companion</Link></p>
  </section></main>;
}
