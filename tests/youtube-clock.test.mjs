import test from 'node:test';
import assert from 'node:assert/strict';
import {youtubeClock} from '../app/youtube-clock.ts';
import {scene} from '../app/subtitles.ts';

test('YouTube seeks suppress stale dialogue until the player confirms its position',()=>{
  const c=youtubeClock(),cue=[{start:0,end:20,text:'later'}];
  assert.equal(c.seek(22,4,300),4);
  for (const [time,state] of [[22,2],[22,1],[4,3]]) {
    assert.equal(scene(cue,c.read(time,state),0).completed,0);
    assert.equal(c.read(time,state),null);
  }
  assert.equal(c.read(3.8,2),3.8);
  assert.equal(c.read(4.2,1),4.2);
});
test('new seek supersedes old seek, clamps to duration and accepts nearby keyframes',()=>{
  const c=youtubeClock();
  c.seek(22,100,300);
  assert.equal(c.seek(22,400,300),300);
  assert.equal(c.read(100,2),null);
  assert.equal(c.read(297,2),297);
  c.seek(297,296.8,300);
  assert.equal(c.read(297,2),null);
  assert.equal(c.read(297.1,1),null);
  assert.equal(c.read(296.8,2),296.8);
});
test('buffering, invalid samples and terminal errors supply no clock',()=>{
  const c=youtubeClock();
  assert.equal(c.read(9,3),null);
  assert.equal(c.read(NaN,1),null);
  assert.equal(c.read(9.7,1),9.7);
  c.fail();
  assert.equal(c.read(10,2),null);
});
