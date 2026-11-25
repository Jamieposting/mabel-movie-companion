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
