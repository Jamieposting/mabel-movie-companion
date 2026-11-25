'use client';
import {useEffect,useState} from 'react';
import type {MutableRefObject} from 'react';
import type {SceneReader} from './scene-panel';
export default function LiveSwitch({reader}:{reader:MutableRefObject<SceneReader|null>}) {
  const [enabled,enable]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{
    if (!enabled) return;
    const controller=new AbortController();
    const signal=controller.signal;
    let timer:ReturnType<typeof setTimeout>;
    async function check() {
      try {
        const res=await fetch('/api/live-scene',{cache:'no-store',signal});
        if (!res.ok) throw Error('Sharing unavailable. Check your sign-in and connection.');
        const {nonce}=await res.json() as {nonce:string|null};
        if(nonce) {
          const scene=reader.current?.(undefined,true);
          const sent=await fetch('/api/live-scene',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nonce,scene}),signal});
          if(sent.ok) setMessage('Scene supplied to your connected chat.');
          else if(sent.status!==409) throw Error('Scene unavailable. Check that the player clock is ready.');
        } else setMessage(previous=>previous.startsWith('Scene supplied')?previous:'Ready for a scene request from your connected chat.');
      } catch(e) { if(!signal.aborted) setMessage((e as Error).message); }
      if(!signal.aborted) timer=setTimeout(check,2000);
    }
    void check();
    return ()=>{controller.abort();clearTimeout(timer);};
  },[enabled,reader]);
  return <div className="live-switch"><button className="primary" aria-pressed={enabled} onClick={()=>{enable(!enabled);setMessage('');}}>{enabled?'Stop sharing live scene':'Share live scene'}</button>
    <p role="status">{enabled?(message||'Connecting…'):'Let your connected Mabel Movie Companion plugin request the current scene while this player is open.'}</p></div>;
}
