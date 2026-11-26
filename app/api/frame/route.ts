import {bucket,slot,readTicket} from '../../live-relay';
export const dynamic='force-dynamic';
const send=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request) {
  const owner=slot(req);
  if(!owner) return send({},401);
  const row=await readTicket(await bucket(),'frame/'+owner);
  if(row?.ticket.retrieved) return send({retrieved:row.ticket.nonce});
  if(row?.ticket.confirm && !row.ticket.reply) return send({confirm:row.ticket.nonce});
  if(!row?.ticket.publicKey || row.ticket.reply) return send({});
  return send({nonce:row.ticket.nonce,publicKey:row.ticket.publicKey});
}
export async function POST(req:Request) {
  const owner=slot(req);
  if(!owner) return send({},401);
  if(req.headers.get('origin')!==new URL(req.url).origin || !req.headers.get('content-type')?.startsWith('application/json')) return send({},403);
  const raw=await req.text();
  if(raw.length>600000) return send({},413);
  let b;
  try { b=JSON.parse(raw); } catch {return send({},400);}
  if(typeof b?.confirm==='string') {
    const db=await bucket(), key='frame/'+owner;
    const row=await readTicket(db,key);
    if(!row?.ticket.confirm || row.ticket.reply || row.ticket.nonce!==b.confirm) return send({},409);
    const saved=await db.put(key,JSON.stringify({...row.ticket,reply:true}),{onlyIf:{etagMatches:row.etag}});
    return send({},saved?200:409);
  }
  if(!b || typeof b.nonce!=='string' || !b.sealed || typeof b.sealed.cipher!=='string' ||
     b.sealed.key?.length!==344 || b.sealed.iv?.length!==16 || !Number.isFinite(b.metadata?.scene?.positionSeconds) ||
     !Array.isArray(b.metadata.scene.dialogue) || b.metadata.scene.dialogue.length>48 ||
     !Number.isFinite(b.metadata.maxCaptureAgeMs) || b.metadata.maxCaptureAgeMs<0 || b.metadata.maxCaptureAgeMs>90000) return send({},400);
  const db=await bucket(), key='frame/'+owner;
  const row=await readTicket(db,key);
  if(!row?.ticket.publicKey || row.ticket.nonce!==b.nonce || row.ticket.reply) return send({},409);
  const reply={metadata:b.metadata,sealed:b.sealed,receivedAt:Date.now()};
  const saved=await db.put(key,JSON.stringify({...row.ticket,reply}),{onlyIf:{etagMatches:row.etag}});
  return send({accepted:!!saved},saved?200:409);
}
