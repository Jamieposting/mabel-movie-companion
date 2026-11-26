'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {cell,stripHeight,palette,newStrip,findPlayerCrop,samePause,type PausedScene} from './frame-marker';
import {sealFrame} from './frame-wire';

type Capture = {
  start:PausedScene; armed:number; target:HTMLElement; width:number; height:number;
  top:number[]; bottom:number[]; jpeg?:string; selected?:number;
};
function strip(colors:number[], bottom:boolean) {
  return <div data-frame-marker="" aria-hidden="true" style={{position:'absolute',...(bottom?{right:0,bottom:0}:{left:0,top:0}),
    zIndex:20,display:'flex',pointerEvents:'none'}}>
    {colors.map((index,i)=><span key={i} style={{width:cell,height:stripHeight,backgroundColor:palette[index]}}/>)}
  </div>;
}
export default function PausedFrame({read,target}:{read:()=>PausedScene|null;target:()=>HTMLElement|null}) {
  const [capture,setCapture]=useState<Capture|null>(null);
  const [approved,approve]=useState(false);
  const [message,report]=useState('Pause the player to capture a frame.');
  const [uploaded,setUploaded]=useState(false);
  const [retrieved,setRetrieved]=useState(false);
  const [age,setAge]=useState(0);
  const generation=useRef(0);
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return ()=>{alive.current=false;};},[]);
  function clear(reason:string) {
    generation.current++;
    setCapture(null);approve(false);setUploaded(false);setRetrieved(false);report(reason);
  }
  function arm() {
    clear('Pause the player first and wait for the clock to settle.');
    const start=read(), element=target();
    if(!start || !element) return;
    const {width,height}=element.getBoundingClientRect();
    setCapture({start,target:element,width,height,armed:Date.now(),top:newStrip(),bottom:newStrip()});
    setAge(0);report('Take an Android screenshot with both colour strips visible, then choose it below.');
    element.scrollIntoView({block:'center'});
  }
  useEffect(()=>{
    if(!capture) return;
    const timer=setInterval(()=>{
      const elapsed=Date.now()-capture.armed;
      if(elapsed>90000 || (document.visibilityState==='visible' && !samePause(capture.start,read()))) {
        clear('Frame expired or playback changed. Pause and capture again.');
      } else setAge(Math.ceil(elapsed/1000));
    },400);
    return ()=>clearInterval(timer);
  },[capture,read]);
  async function choose(file?:File) {
    if(!file || !capture) return;
    const id=++generation.current;
    try {
      if(!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>16000000) throw Error('Choose a PNG, JPEG or WebP screenshot under 16 MB.');
      const bitmap=await createImageBitmap(file);
      let jpeg:string;
      try {
        if(bitmap.width*bitmap.height>16000000) throw Error('Screenshot exceeds 16 megapixels.');
        const canvas=document.createElement('canvas');
        canvas.width=bitmap.width;canvas.height=bitmap.height;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        if(!ctx) throw Error('Canvas unavailable.');
        ctx.drawImage(bitmap,0,0);
        const crop=findPlayerCrop(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,
          capture.top,capture.bottom,capture.width,capture.height);
        canvas.width=canvas.height=0;
        if(!crop) throw Error('The current player markers did not match. Take a new screenshot with both strips visible.');
        const out=document.createElement('canvas');
        out.width=Math.min(960,crop.width);out.height=Math.max(1,Math.round(crop.height*out.width/crop.width));
        out.getContext('2d')!.drawImage(bitmap,crop.x,crop.y,crop.width,crop.height,0,0,out.width,out.height);
        jpeg=out.toDataURL('image/jpeg',0.78);
        if(jpeg.length>470000) throw Error('Crop too large to share.');
      } finally {bitmap.close();}
      if(!alive.current || generation.current!==id) return;
      if(!samePause(capture.start,read()) || Date.now()-capture.armed>90000) throw Error('Paused scene expired.');
      setCapture({...capture,jpeg,selected:Date.now()});report('Check the crop. Approve only if it shows the paused video and contains nothing private.');
    } catch(e) {if(alive.current && generation.current===id) clear((e as Error).message);}
  }
  useEffect(()=>{
    if(!approved || !capture?.jpeg) return;
    const active=capture;
    const jpeg=capture.jpeg.split(',')[1],controller=new AbortController(),signal=controller.signal;
    let timer:ReturnType<typeof setTimeout>,sent:string|undefined;
    const valid=()=>!signal.aborted && document.visibilityState==='visible' && Date.now()-capture.armed<=90000 && samePause(capture.start,read());
    async function poll() {
      try {
        if(valid()) {
          const res=await fetch('/api/frame',{cache:'no-store',signal});
          if(!res.ok) throw Error('Frame relay unavailable. Check preview sign-in.');
          const ticket=await res.json() as {nonce?:string;publicKey?:JsonWebKey;retrieved?:string;confirm?:string};
          if(sent && ticket.confirm===sent && valid()) {
            const ack=await fetch('/api/frame',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:sent}),signal});
            if(!ack.ok) throw Error('Frame confirmation expired.');
          }
          if(sent && ticket.retrieved===sent) {setRetrieved(true);report('MCP server retrieved the upload. Confirm what ChatGPT actually saw in chat.');return;}
          if(ticket.nonce && ticket.publicKey && !sent && valid()) {
            const sealed=await sealFrame(ticket.publicKey,jpeg);
            if(!valid()) throw Error('Paused frame changed before upload.');
            const metadata={scene:active.start.scene,status:'paused',rate:active.start.rate,source:'viewer-approved Android screenshot crop',
              captureWindowStart:active.armed,captureWindowEnd:active.selected,maxCaptureAgeMs:Date.now()-active.armed};
            const put=await fetch('/api/frame',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nonce:ticket.nonce,metadata,sealed}),signal});
            if(!put.ok) throw Error(put.status===409?'Observation request expired. Ask again.':'Frame upload failed.');
            sent=ticket.nonce;setUploaded(true);report('Encrypted crop uploaded. Waiting for retrieval.');
          }
        }
      } catch(e) {if(!signal.aborted) report((e as Error).message);}
      if(!signal.aborted) timer=setTimeout(poll,700);
    }
    void poll();return ()=>{controller.abort();clearTimeout(timer);};
  },[capture,approved,read]);
  return <section aria-label="Paused screenshot sharing">
    <h3>Share a paused screenshot</h3>
    <p>YouTube embeds expose no pixels to this page. Android Chrome has no supported automatic tab capture. Use a device screenshot. Only the crop you approve is sent.</p>
    {!capture && <button onClick={arm}>Mark paused player</button>}
    {capture && <>
      {!capture.jpeg && createPortal(<>{strip(capture.top,false)}{strip(capture.bottom,true)}</>,capture.target)}
      {!capture.jpeg && <label>Choose Android screenshot<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{void choose(e.target.files?.[0]);e.target.value='';}}/></label>}
      {capture.jpeg && <figure><picture><img src={capture.jpeg} alt="Player crop to review" style={{maxWidth:'100%'}}/></picture><figcaption>Paused at {capture.start.time.toFixed(2)} s · capture age at most {age} s</figcaption></figure>}
      {capture.jpeg && !approved && <button onClick={()=>{if(samePause(capture.start,read())) {approve(true);report('Ready for one frame request. Keep the player visible in split-screen.');}}}>Approve this crop for Mabel</button>}
      <button onClick={()=>clear('Frame sharing stopped. Local crop discarded.')}>Stop and discard crop</button>
    </>}
    <p role="status">{message}</p>
    <dl><dt>Pixels captured</dt><dd>{capture?.jpeg?'Yes · viewer-selected crop':'Awaiting screenshot'}</dd>
      <dt>Frame uploaded</dt><dd>{uploaded?'Yes':'No'}</dd><dt>Frame retrieved</dt><dd>{retrieved?'MCP server read the upload':'Unconfirmed'}</dd>
      <dt>ChatGPT visual interpretation</dt><dd>Verify the answer against the image in this conversation.</dd></dl>
  </section>;
}
