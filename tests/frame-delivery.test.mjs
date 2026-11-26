import test from 'node:test';
import assert from 'node:assert/strict';
import {findPlayerCrop,newStrip,palette,cell,stripHeight,samePause} from '../app/frame-marker.ts';
import {frameKeys,sealFrame,openFrame} from '../app/frame-wire.ts';

for(const scale of [1,1.5,2]) test('only player pixels survive screenshot crop at scale '+scale,()=>{
  const width=520*scale,height=380*scale,top=newStrip(),bottom=newStrip();
  const data=new Uint8ClampedArray(width*height*4);
  const draw=(strip,x,y)=>strip.forEach((c,i)=>{
    const rgb=palette[c].slice(1).match(/../g).map(hex=>parseInt(hex,16));
    for(let row=y*scale;row<(y+stripHeight)*scale;row++)
      for(let col=(x+i*cell)*scale;col<(x+(i+1)*cell)*scale;col++) data.set([...rgb,255],(row*width+col)*4);
  });
  draw(top,20,10);draw(bottom,420-bottom.length*cell,230-stripHeight);
  const crop=findPlayerCrop(data,width,height,top,bottom,400,220);
  assert.ok(crop && crop.x>20*scale && crop.x+crop.width<420*scale);
  assert.ok(crop.y>=18*scale && crop.y+crop.height<=222*scale);
  assert.equal(findPlayerCrop(data,width,height,bottom,top,400,220),null);
  assert.equal(findPlayerCrop(data,width,height,top,bottom,200,220),null);
});
test('resume, rewind, source or speed change invalidates approved pause',()=>{
  const a={session:'a',epoch:1,rate:1,time:20,scene:{dialogue:[]}};
  assert.ok(samePause(a,{...a}));
  for(const b of [null,{...a,time:10},{...a,epoch:2},{...a,session:'b'},{...a,rate:2}]) assert.equal(samePause(a,b),false);
});
test('only the waiting request can unpack the image block, independent of captions',async()=>{
  const a=await frameKeys(),b=await frameKeys(),jpeg='/9j/2Q==';
  const seal=await sealFrame(await crypto.subtle.exportKey('jwk',a.publicKey),jpeg);
  assert.deepEqual(await openFrame(a.privateKey,seal),{type:'image',mimeType:'image/jpeg',data:jpeg});
  await assert.rejects(openFrame(b.privateKey,seal));
  const invalid=await sealFrame(await crypto.subtle.exportKey('jwk',a.publicKey),'AAAA');
  await assert.rejects(openFrame(a.privateKey,invalid));
});
