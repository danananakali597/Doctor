import test from 'node:test';import assert from 'node:assert/strict';
import {MessageLogCache,messageText} from '../src/message-log-cache.js';
test('message snapshots are bounded, expire and do not cross guilds',()=>{
 let now=0;const cache=new MessageLogCache({limit:2,ttl:10,clock:()=>now});
 const msg=(id,guild='one')=>({id,guild:{id:guild},author:{id:'user'},content:'hello'});
 cache.remember(msg('1'));assert.equal(cache.get(msg('1','two')),undefined);
 cache.remember(msg('2'));cache.remember(msg('3'));assert.equal(cache.get(msg('1')),undefined);
 now=11;assert.equal(cache.get(msg('2')),undefined);assert.equal(cache.get(msg('3')),undefined);
});
test('missing content is described honestly rather than fabricated',()=>{assert.match(messageText(),/did not receive/);assert.equal(messageText({content:'hello'}),'hello');});
