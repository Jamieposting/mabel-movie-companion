import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSubtitles, scene, inCommentaryGap } from '../app/subtitles.ts';
import { manualClock } from '../app/manual-clock.ts';
const cues = parseSubtitles('\uFEFF1\r\n00:00:00,000 --> 00:00:02,000\r\nBrass key\r\n\r\n2\r\n00:00:09,000 --> 00:00:11,000\r\nRed clock');
test('no partial cue, future dialogue, or stale result after rewind', () => {
  for (const [time,count] of [[null,0],[1.999,0],[2,1],[10.999,1],[11,2],[1,0]]) assert.equal(scene(cues,time,0).dialogue.length,count);
  assert.equal(scene(cues,2,1).completed,0);
  assert.equal(scene(cues,1,-1).completed,1);
});
test('VTT metadata, overlap, cue settings, identifiers, and out-of-order ends', () => {
  const vtt = parseSubtitles('WEBVTT\n\nNOTE ignore\nowner\n\na\n00:01.000 --> 00:08.000 align:start\n<v Mabel>Later\n\nb\n00:02.000 --> 00:03.000\n<i>Earlier</i>');
  assert.deepEqual(scene(vtt,4,0).dialogue,[{at:2,line:'Earlier'}]);
  assert.equal(scene(vtt,8,0).dialogue[0].line,'Mabel: Later');
});
test('malformed or merged blocks fail instead of leaking a future cue', () => {
  for(const text of ['garbage','00:10.000 --> 00:02.000\nBad','00:00.000 --> 00:02.000\nFirst\n00:04.000 --> 00:05.000\nSecret']) assert.throws(()=>parseSubtitles(text));
});
test('earlier pages remain inside the clock cutoff', () => {
  const many=Array.from({length:100},(_,i)=>({start:i,end:i+1,text:String(i)}));
  const latest=scene(many,60,0);
  assert.equal(latest.dialogue.length,48);
  assert.equal(scene(many,60,0,latest.earlierBefore).dialogue.at(-1).line,'11');
  assert.equal(scene(many,2,0,latest.earlierBefore).dialogue.at(-1).line,'1');
});
test('gap protects ongoing dialogue and dialogue about to start', () => {
  assert.equal(inCommentaryGap(cues,1,0),false);
  assert.equal(inCommentaryGap(cues,3,0),true);
  assert.equal(inCommentaryGap(cues,8,0),false);
});
test('play, throttled rendering, pause, seek and resume', () => {
  let now=100; const c=manualClock(()=>now);
  c.play(); now+=60000; assert.equal(c.read(),60);
  c.pause(); now+=100000; assert.equal(c.read(),60);
  c.seek(10); c.play(); now+=750; assert.equal(c.read(),10.75);
  c.seek(-2); assert.equal(c.read(),0);
});
