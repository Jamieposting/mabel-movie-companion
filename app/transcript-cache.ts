import {transcriptCues} from './youtube-captions.ts';

export const videoPattern = /^[\w-]{11}$/;
export function videoKey(owner:string, videoId:string) {
  if (typeof videoId !== 'string' || !videoPattern.test(videoId)) throw Error('Invalid YouTube video ID.');
  return 'vidiq/' + owner + '/' + videoId;
}

type Pending = {state:'pending'; reservation:string; until:number};
type Ready = {state:'ready'; language:string; transcription:string; lines:number};
type Entry = Pending | Ready;

export async function prepare(db:R2Bucket, key:string) {
  const obj = await db.get(key);
  const row = obj && await obj.json<Entry>();
  if (row?.state === 'ready') return {status:'cached',lines:row.lines};
  if (row?.state === 'pending' && row.until > Date.now()) return {status:'in_progress'};
  const reservation = crypto.randomUUID();
  const entry:Pending = {state:'pending',reservation,until:Date.now()+300000};
  const saved = await db.put(key, JSON.stringify(entry), {
    onlyIf:obj ? {etagMatches:obj.etag} : {etagDoesNotMatch:'*'}
  });
  return saved ? {status:'extract_once',reservation} : {status:'in_progress'};
}

export async function finish(db:R2Bucket,key:string,reservation:string,language:string,transcription:string) {
  const obj = await db.get(key);
  const row = obj && await obj.json<Entry>();
  if (row?.state === 'ready') return {status:'cached',lines:row.lines};
  if (!obj || row?.state !== 'pending' || row.reservation !== reservation) throw Error('Reservation expired or replaced.');
  if (typeof transcription !== 'string' || transcription.length>4000000 ||
      !/^\[(?:\d+:)?\d+:[0-5]\d\](?:\s|$)/.test(transcription.trim()) ||
      transcription.split(/\r?\n/).some(s=>/^\[\d+:/.test(s.trim()) && !/^\[(?:\d+:)?\d+:[0-5]\d\](?:\s|$)/.test(s.trim()))) throw Error('Incomplete or invalid vidIQ transcript.');
  const lines = transcriptCues(transcription,null).length;
  const entry:Ready = {state:'ready',language,transcription,lines};
  if (!await db.put(key,JSON.stringify(entry),{onlyIf:{etagMatches:obj.etag}})) throw Error('Reservation changed. Check the cache before retrying.');
  return {status:'cached',lines};
}

export async function forPlayer(db:R2Bucket,key:string) {
  const obj = await db.get(key);
  const row = obj && await obj.json<Entry>();
  return row?.state === 'ready' ? {language:row.language,transcription:row.transcription} : null;
}
