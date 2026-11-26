import assert from 'node:assert/strict';
import test from 'node:test';
import {observe,observePlayer} from '../host/observe.mjs';
import {playerClip} from '../app/visual-observation.ts';

function sample(seconds=7, changes={}) {
  const scene={positionSeconds:seconds,dialogue:seconds>=7.1?['first','second']:['first']};
  return {scene,frame:{session:'film',epoch:1,sampledAt:1000,rate:1,status:'playing',
    pixelRatio:1,clip:{x:1,y:2,width:300,height:200},scene,...changes}};
}
const image=new Uint8Array([1,2,3]);
function pair(a,b,capture=()=>image,now=1200) {
  return observe({initial:a,read:async()=>b,capture,now:()=>now});
}
test('returns pixels with the earlier completed-dialogue cutoff at 2x speed',async()=>{
  const result=await pair(sample(7,{rate:2}),sample(7.2,{rate:2,sampledAt:1100}));
  assert.deepEqual(result.mediaRange,[7,7.2]);assert.deepEqual(result.scene.dialogue,['first']);assert.equal(result.image,image);
});
test('paused stills are eligible and time must stay fixed',async()=>{
  const start=sample(7,{status:'paused'});
  assert.equal((await pair(start,sample(7,{status:'paused',sampledAt:1100}))).image,image);
  assert.equal((await pair(start,sample(7.05,{status:'paused',sampledAt:1100}))).image,undefined);
});
test('rejects rewind, seek, source switch, rate change, layout shift and expired capture',async()=>{
  for (const end of [sample(6), sample(30),sample(7,{epoch:2}),sample(7,{session:'other'}),
    sample(7,{rate:2}),sample(7,{status:'loading'}),sample(7,{pixelRatio:2}),
    sample(7,{clip:{x:5,y:2,width:300,height:200}})]) {
    const result=await pair(sample(),end);
    assert.equal(result.image,undefined);assert.deepEqual(result.scene,end.scene);
  }
  assert.equal((await pair(sample(),sample(),()=>image,2500)).image,undefined);
});
test('denied capture, revoked consent and missing screenshot API give dialogue only',async()=>{
  const end=sample(2);
  const denied=await pair(sample(),end,()=>{throw Error('blocked')});
  assert.equal(denied.image,undefined);assert.equal(denied.scene,end.scene);
  assert.equal((await pair(sample(),{scene:end.scene,frame:null})).image,undefined);
  assert.equal((await observe({read:()=>end})).scene,end.scene);
});
test('crop stays inside a fully visible player',()=>{
  assert.equal(playerClip({left:0,top:-1,right:200,bottom:100},300,200),null);
  assert.deepEqual(playerClip({left:1.1,top:2.2,right:200.7,bottom:100.8},300,200),{x:2,y:3,width:198,height:97});
});
test('scheduled host capture waits for WebMCP then captures and validates once',async()=>{
  const calls=[];
  const snapshot=sample(7,{status:'paused',sampledAt:Date.now()-20});
  const result=await observePlayer({screenshot:async()=>{calls.push('capture');return image}},
    {scheduled:true,readTool:async name=>{calls.push(name);return {ok:true,...snapshot,frame:{...snapshot.frame,sampledAt:name==='watch_read_checkpoint'?Date.now():snapshot.frame.sampledAt},observation:{wakeReason:'interval'}}}});
  assert.deepEqual(calls,['watch_observe_next_moment','capture','watch_read_checkpoint']);
  assert.equal(result.image,image);assert.equal(result.observation.wakeReason,'interval');
});
