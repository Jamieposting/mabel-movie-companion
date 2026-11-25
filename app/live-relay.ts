// Both endpoints receive the same site-scoped caller ID from Sites.
export function slot(request: Request) {
  const owner = request.headers.get('oai-authenticated-user-id');
  return owner ? 'scene-request/' + encodeURIComponent(owner) : null;
}
export async function bucket(): Promise<R2Bucket> {
  const {env} = await import('cloudflare:workers');
  return (env as unknown as {BUCKET:R2Bucket}).BUCKET;
}
type Ticket = {nonce:string; expires:number; reply?: unknown};
export async function readTicket(db:R2Bucket,key:string) {
  const object = await db.get(key);
  if (!object) return null;
  const ticket = await object.json<Ticket>();
  return ticket.expires > Date.now() ? {ticket, etag:object.etag} : null;
}
export async function askPlayer(db:R2Bucket,key:string) {
  const nonce = crypto.randomUUID();
  const expires = Date.now()+12000;
  const claim = await db.put(key, JSON.stringify({nonce,expires}));
  if (!claim) throw Error('Unable to reach scene relay.');
  let etag = claim.etag;
  try {
    while (Date.now()<expires) {
      await new Promise(resolve=>setTimeout(resolve,750));
      const current = await readTicket(db,key);
      if (!current || current.ticket.nonce!==nonce) break;
      etag=current.etag;
      if (current.ticket.reply) return current.ticket.reply;
    }
    throw Error('No live response. Keep the companion visible with Share live scene enabled, then ask again.');
  } finally {
    // Only clear this request. A newer caller may already hold the slot.
    await db.put(key,JSON.stringify({expires:0}),{onlyIf:{etagMatches:etag}});
  }
}
