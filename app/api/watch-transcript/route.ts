import {bucket,slot} from '../../live-relay';
import {prepare,finish,forPlayer,videoKey,videoPattern} from '../../transcript-cache';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  const reply=(data:unknown,status:number)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
  const owner=slot(req);
  const id=new URL(req.url).searchParams.get('videoId') ?? '';
  if (!owner) return reply({},401);
  if (!videoPattern.test(id)) return reply({},400);
  const entry=await forPlayer(await bucket(),videoKey(owner,id));
  return reply(entry,entry?200:404);
}

// A previously obtained vidIQ response can be imported without another provider call.
export async function POST(req:Request) {
  const owner=slot(req);
  if (!owner) return new Response(null,{status:401});
  if (req.headers.get('origin')!==new URL(req.url).origin || !req.headers.get('content-type')?.startsWith('application/json')) return new Response(null,{status:403});
  const id=new URL(req.url).searchParams.get('videoId') ?? '';
  if (!videoPattern.test(id)) return new Response(null,{status:400});
  try {
    const raw=await req.text();
    if (raw.length>4200000) return new Response(null,{status:413});
    const data=JSON.parse(raw);
    if (data.videoId!==id || typeof data.transcription!=='string') return new Response(null,{status:400});
    const db=await bucket(), key=videoKey(owner,id);
    const claim=await prepare(db,key);
    if (claim.status==='in_progress') return new Response(null,{status:409});
    if (claim.reservation) await finish(db,key,claim.reservation,data.language ?? '',data.transcription);
    return new Response(null,{status:204});
  } catch { return new Response(null,{status:422}); }
}
