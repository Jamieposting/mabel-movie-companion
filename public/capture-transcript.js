// This bookmark reads the transcript controls on the YouTube watch page it runs on.
(async function () {
  const origin = '__EXTRACTOR_ORIGIN__';
  const id = new URL(location.href).searchParams.get('v');
  if (!['www.youtube.com','m.youtube.com','youtube.com'].includes(location.hostname) || !/^[\w-]{11}$/.test(id || '')) {
    alert('Open a YouTube watch page in your browser, then run Extract transcript.');
    return;
  }
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const rows = () => {
    const groups = [];
    for (const row of document.querySelectorAll('transcript-segment-view-model,ytd-transcript-segment-renderer,ytm-transcript-segment-renderer')) {
      if (!row.getClientRects().length) continue;
      const time = row.querySelector('[class$="ViewModelTimestamp"],.segment-timestamp')?.textContent.trim();
      const text = row.querySelector('span.ytAttributedStringHost,.segment-text')?.textContent.trim();
      if (!text || !/^\d+(?::\d{2}){1,2}$/.test(time || '')) continue;
      const start = time.split(':').reduce((a,b) => 60*a+Number(b),0);
      const prev = groups.at(-1);
      if (prev && start < prev.start) continue;
      if (prev?.start === start) { if (text !== prev.text) prev.text += ' '+text; }
      else groups.push({start,text});
    }
    return groups;
  };
  let lines = rows();
  if (!lines.length) {
    document.querySelector('ytd-watch-metadata #expand,ytm-expandable-video-description-body-renderer button')?.click();
    for (let i=0;i<12;i++) {
      const trigger = Array.from(document.querySelectorAll('button,[role="button"]')).find(el =>
        el.getClientRects().length && /^show transcript$/i.test((el.getAttribute('aria-label') || el.innerText || '').trim()));
      if (trigger) {trigger.click(); break;}
      await sleep(200);
    }
    for (let i=0;i<30 && !lines.length;i++) {await sleep(250); lines=rows();}
  }
  if (!lines.length) {alert('No timed rows found. Open Show transcript on YouTube, then run the bookmark again. If the mobile layout has no panel, try Desktop site.');return;}
  const duration = document.querySelector('video')?.duration;
  const stamp = seconds => new Date(Math.floor(seconds*1000)).toISOString().slice(11,23).replace('.',',');
  const cues = lines.map((line,i)=>({...line,end:lines[i+1]?.start ?? duration})).filter(c=>Number.isFinite(c.end) && c.end>c.start);
  if (!cues.length) {alert('The timeline is not ready yet. Wait for the video duration and try again.');return;}
  if (window.opener && !window.opener.closed) {
    const ack = new Promise(resolve=>{
      const listener = e => {
        if(e.origin === origin && e.source === window.opener && e.data?.type === 'mabel-transcript-saved' && e.data.id===id) finish(true);
      };
      const finish = ok => {clearTimeout(timer);removeEventListener('message',listener);resolve(ok);};
      const timer = setTimeout(()=>finish(false),1800);
      addEventListener('message',listener);
    });
    window.opener.postMessage({type:'mabel-transcript',id,cues},origin);
    if(await ack) {alert(cues.length+' timed lines sent. Return to the extractor tab.');return;}
  }
  const srt=cues.map((c,i)=>(i+1)+'\n'+stamp(c.start)+' --> '+stamp(c.end)+'\n'+c.text+'\n').join('\n');
  const link=document.createElement('a');
  const url=URL.createObjectURL(new Blob([srt],{type:'application/x-subrip;charset=utf-8'}));
  link.href=url;link.download=id+'.srt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  alert(cues.length+' timed lines exported as '+id+'.srt. Choose that file in the companion.');
})()
