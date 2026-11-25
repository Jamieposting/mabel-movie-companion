import test from 'node:test';
import assert from 'node:assert/strict';
import {captionTrack,transcriptCues} from '../app/youtube-captions.ts';
import {scene} from '../app/subtitles.ts';
const id='M7lc1UVf-VE';
const english={baseUrl:'https://www.youtube.com/api/timedtext?v='+id,languageCode:'en',name:'A ] label'};
test('selects matching public English captions and prefers creator captions',()=>{
 const tracks=[{...english,baseUrl:'https://example.org/api/timedtext?v='+id},{...english,kind:'asr'},english];
 assert.deepEqual(captionTrack(JSON.stringify({captionTracks:tracks}),id),english);
 assert.equal(captionTrack(JSON.stringify({captionTracks:tracks}),'differentID'),null);
 assert.equal(captionTrack('consent required',id),null);
});
test('timestamped transcript groups wrapped lines and withholds dialogue until next timestamp',()=>{
 const cues=transcriptCues('0:00\nFirst\nline\n0:02  Last line',7);
 assert.deepEqual(scene(cues,1,0).dialogue,[]);
 assert.equal(scene(cues,4,0).dialogue[0].line,'First line');
 assert.equal(scene(cues,7,0).completed,2);
 assert.equal(scene(transcriptCues('0:02 last',null),20,0).completed,0);
 assert.throws(()=>transcriptCues('untimed',null));
});
