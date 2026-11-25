import {captionTrack} from '../../youtube-captions';
import {parseSubtitles} from '../../subtitles';

async function publicText(url: URL, limit: number) {
  const response = await fetch(url, {redirect:'error',cache:'no-store',signal:AbortSignal.timeout(9000)});
  if (!response.ok || !response.body) throw Error('Unavailable');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let text = '', bytes = 0;
  for (;;) {
    const {value,done} = await reader.read();
    if (done) return text + decoder.decode();
    bytes += value.byteLength;
    if (bytes > limit) {await reader.cancel(); throw Error('Response too large');}
    text += decoder.decode(value,{stream:true});
  }
}

export async function GET(request:Request) {
  const videoId=new URL(request.url).searchParams.get('videoId');
  if(!videoId || !/^[\w-]{11}$/.test(videoId)) return Response.json({error:'Invalid video ID.'},{status:400});
  try {
    const watch=new URL('https://www.youtube.com/watch');
    watch.searchParams.set('v',videoId);
    const track=captionTrack(await publicText(watch,5_000_000),videoId);
    if (!track) throw Error('No public track');
    const address=new URL(track.baseUrl);
    address.searchParams.set('fmt','vtt');
    const vtt=await publicText(address,4_000_000);
    const cues=parseSubtitles(vtt);
    return Response.json({cues,language:track.languageCode,automatic:track.kind==='asr'},{headers:{'Cache-Control':'private, no-store'}});
  } catch {
    return Response.json({error:'YouTube did not supply a readable public caption track.'},{status:422,headers:{'Cache-Control':'no-store'}});
  }
}
