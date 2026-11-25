import test from 'node:test';
import assert from 'node:assert/strict';
import {videoKey,prepare,finish,forPlayer} from '../app/transcript-cache.ts';
import {transcriptCues} from '../app/youtube-captions.ts';
import {scene} from '../app/subtitles.ts';

function memoryBucket() {
  const data=new Map();
  return {
    async get(key) { return data.get(key) ?? null; },
    async put(key,body,{onlyIf}) {
      const old=data.get(key);
      if (onlyIf.etagDoesNotMatch==='*' && old || onlyIf.etagMatches && old?.etag!==onlyIf.etagMatches) return null;
      const obj={etag:crypto.randomUUID(),json:async()=>JSON.parse(body)};
      data.set(key,obj);
      return obj;
    }
  };
}

test('one reservation, private cache, wrapped captions and completed-only reads across clock changes',async()=>{
  const result={videoId:'demoVideo01',language:'en',transcription:'[0:00] First\ncontinued\n[0:16] Second\n[1:06:32] Last'};
  const db=memoryBucket(), key=videoKey('user-a',result.videoId);
  const [a,b]=await Promise.all([prepare(db,key),prepare(db,key)]);
  assert.equal(a.status,'extract_once');
  assert.equal(b.status,'in_progress');
  await assert.rejects(finish(db,key,'wrong',result.language,result.transcription));
  const saved=await finish(db,key,a.reservation,result.language,result.transcription);
  assert.deepEqual(await prepare(db,key),saved);
  assert.equal(await forPlayer(db,videoKey('user-b',result.videoId)),null);
  const data=await forPlayer(db,key);
  const cues=transcriptCues(data.transcription,null);
  assert.equal(cues.length,saved.lines);
  assert.equal(cues.at(-1).start,3992);
  for (const time of [0,1,15.9,16,16,17,19,21,3950,1100,4,3992]) {
    const packet=scene(cues,time,0);
    assert.equal(packet.completed,cues.filter(c=>c.end<=time).length);
    assert.deepEqual(packet.dialogue,cues.filter(c=>c.end<=time).slice(-48).map(c=>({at:c.start,line:c.text})));
  }
  assert.equal(scene(cues,15.9,0).completed,0);
  assert.equal(scene(cues,16,0).completed,1);
  assert.ok(cues[0].text.includes(' '));
});
