import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseSubtitles} from '../app/subtitles.ts';
const source=await readFile(new URL('../public/capture-transcript.js',import.meta.url),'utf8');
function sample(){
  let file,downloaded=false;
  const alerts=[];
  const rows=[['0:10','First'],['0:19','Second']].map(([time,text])=>({
    getClientRects:()=>[{}],querySelector:s=>({textContent:s.includes('Timestamp')?time:text})
  }));
  class LocalURL extends URL {static createObjectURL(b){file=b;return 'blob:test';}static revokeObjectURL(){}}
  const link={click(){downloaded=true;},remove(){}};
  const ctx={URL:LocalURL,Blob,location:new URL('https://www.youtube.com/watch?v=M7lc1UVf-VE'),window:{},
    setTimeout:(fn,ms)=>ms===60000?0:setTimeout(fn,ms),clearTimeout,
    alert:x=>alerts.push(x),document:{querySelectorAll:()=>rows,querySelector:()=>({duration:25}),createElement:()=>link,body:{append(){}}}};
  return {ctx,file:()=>file,downloaded:()=>downloaded,alerts};
}
test('standalone capture downloads parseable SRT when tabs are isolated',async()=>{
  const s=sample();await vm.runInNewContext(source,s.ctx);
  assert.equal(s.downloaded(),true);
  assert.deepEqual(parseSubtitles(await s.file().text()),[{start:10,end:19,text:'First'},{start:19,end:25,text:'Second'}]);
});
test('extractor accepts a matching-tab acknowledgement and skips duplicate download',async()=>{
  const s=sample(),origin='https://example.test';let listener;
  s.ctx.addEventListener=(name,fn)=>{listener=fn};s.ctx.removeEventListener=()=>{};
  s.ctx.window.opener={postMessage(message,target){
    assert.equal(target,origin);assert.equal(message.cues.length,2);
    listener({origin,source:this,data:{type:'mabel-transcript-saved',id:message.id}});
  }};
  await vm.runInNewContext(source.replace('__EXTRACTOR_ORIGIN__',origin),s.ctx);
  assert.equal(s.downloaded(),false);assert.match(s.alerts[0],/2 timed lines sent/);
});
