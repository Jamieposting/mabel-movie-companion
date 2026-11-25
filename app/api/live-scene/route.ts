import {bucket,slot,readTicket} from '../../live-relay';
export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request) {
  const key=slot(request);
  if (!key) return reply({error:'Sign in to share.'},401);
  const row=await readTicket(await bucket(),key);
  return reply({nonce:row && !row.ticket.reply ? row.ticket.nonce : null});
}
export async function POST(request:Request) {
  const key=slot(request);
  if (!key) return reply({},401);
  if (request.headers.get('sec-fetch-site')==='cross-site' || !request.headers.get('content-type')?.startsWith('application/json')) return reply({},403);
  const raw=await request.text();
  if(raw.length>65000) return reply({},413);
  let body;
  try { body=JSON.parse(raw); } catch { return reply({},400); }
  if (!body || typeof body.nonce!=='string' || !body.scene || !Number.isFinite(body.scene.positionSeconds) || !Array.isArray(body.scene.dialogue) || body.scene.dialogue.length>48) return reply({},400);
  const db=await bucket();
  const row=await readTicket(db,key);
  if(!row || row.ticket.nonce!==body.nonce || row.ticket.reply) return reply({},409);
  const saved=await db.put(key, JSON.stringify({...row.ticket,reply:body.scene}),{onlyIf:{etagMatches:row.etag}});
  return reply({accepted:!!saved},saved?200:409);
}
