import assert from 'node:assert/strict';
import test from 'node:test';
import {askPlayer,readTicket,slot} from '../app/live-relay.ts';

test('fresh scene request replaces old dialogue and clears the response',async()=>{
  let text=JSON.stringify({expires:Date.now()+50000,reply:'future content'});
  let version=0;
  const db={
    async get(){return {etag:String(version),json:async()=>JSON.parse(text)};},
    async put(key,value,options){
      if (options && options.onlyIf.etagMatches!==String(version)) return null;
      text=value;return {etag:String(++version)};
    },
  };
  const response=askPlayer(db,'viewer');
  const pending=await readTicket(db,'viewer');
  assert.equal(pending.ticket.reply,undefined);
  await db.put('viewer',JSON.stringify({...pending.ticket,reply:{positionSeconds:3,dialogue:['first line']}}),{onlyIf:{etagMatches:pending.etag}});
  assert.deepEqual(await response,{positionSeconds:3,dialogue:['first line']});
  assert.equal(await readTicket(db,'viewer'),null);
});
test('viewer slots depend on signed-in Site identity',()=>{
  assert.equal(slot(new Request('https://example.org')),null);
  const who=id=>slot(new Request('https://example.org',{headers:{'oai-authenticated-user-id':id}}));
  assert.notEqual(who('A'),who('B'));
});

test('image reply is released only after a second live confirmation',async()=>{
  let version=0,text='';
  const db={
    async get(){return text ? {etag:String(version),json:async()=>JSON.parse(text)} : null;},
    async put(key,value,options) {
      if(options && options.onlyIf.etagMatches!==String(version)) return null;
      text=value;return {etag:String(++version)};
    }
  };
  const response=askPlayer(db,'frame/viewer',{kty:'RSA'});
  let row=await readTicket(db,'frame/viewer');
  await db.put('frame/viewer',JSON.stringify({...row.ticket,reply:{sealed:'opaque'}}));
  await new Promise(resolve=>setTimeout(resolve,900));
  row=await readTicket(db,'frame/viewer');
  assert.equal(row.ticket.confirm,true);
  assert.equal(row.ticket.reply,undefined);
  await db.put('frame/viewer',JSON.stringify({...row.ticket,reply:true}));
  assert.deepEqual(await response,{sealed:'opaque'});
  assert.equal((await readTicket(db,'frame/viewer')).ticket.retrieved,true);
});
