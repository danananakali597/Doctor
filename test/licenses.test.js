import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'vex-licenses-'));
const {db,grant,plan}=await import('../src/db.js');
const {createGiftKey,listGiftKeys,revokeGiftKey,redeemGiftKey}=await import('../src/licenses.js');
test('gift keys store only a hash and never return the secret in listings',()=>{
 const created=createGiftKey('plus','operator');assert.match(created.key,/^VEX-[A-F0-9]{48}$/);
 const row=db.prepare('SELECT * FROM gift_keys WHERE id=?').get(created.id);
 assert.equal(JSON.stringify(row).includes(created.key),false);assert.equal(row.hash.length,64);
 const listed=listGiftKeys().find(k=>k.id===created.id);assert.equal(listed.status,'unused');assert.equal('key'in listed,false);assert.equal('hash'in listed,false);
 assert.throws(()=>createGiftKey('basic','operator'));
});
test('a gift month starts on redemption, not creation, and accepts pasted lower-case keys',t=>{
 let now=Date.UTC(2026,9,8,10,30);t.mock.method(Date,'now',()=>now);
 const created=createGiftKey('ultimate','operator');now=Date.UTC(2026,10,8,10,30);
 const result=redeemGiftKey(' '+created.key.toLowerCase()+' ','recipient','friend');
 assert.deepEqual(result,{plan:'ultimate',expires:Date.UTC(2026,11,8,10,30)});assert.equal(plan('recipient'),'ultimate');
 const item=listGiftKeys().find(k=>k.id===created.id);assert.equal(item.guild,'recipient');assert.equal(item.redeemedBy,'friend');assert.equal(item.redeemedAt,now);
 assert.throws(()=>redeemGiftKey(created.key,'other-guild','other-friend'),/unavailable/);assert.throws(()=>revokeGiftKey(created.id));
 now=result.expires;assert.equal(plan('recipient'),'basic');
});
test('revoked, missing and malformed keys cannot grant access',()=>{
 const created=createGiftKey('plus','operator');revokeGiftKey(created.id);
 assert.throws(()=>redeemGiftKey(created.key,'revoked','friend'),/unavailable/);
 for(const key of [null,{},'', 'VEX-'+'A'.repeat(48)])assert.throws(()=>redeemGiftKey(key,'revoked','friend'),/unavailable/);
 assert.equal(plan('revoked'),'basic');assert.equal(listGiftKeys().find(k=>k.id===created.id).status,'revoked');
});
test('same-tier gifts extend access; immediate upgrade preserves unused value in only this guild',t=>{
 const now=Date.UTC(2026,9,8,12);t.mock.method(Date,'now',()=>now);
 const existing=Date.UTC(2026,9,20,12);grant('renewal','plus',existing);
 const plus=createGiftKey('plus','operator'),renewed=redeemGiftKey(plus.key,'renewal','friend');assert.equal(renewed.expires,Date.UTC(2026,10,20,12));
 const ultimate=createGiftKey('ultimate','operator'),upgraded=redeemGiftKey(ultimate.key,'renewal','friend');assert.equal(upgraded.upgraded,true);assert.equal(upgraded.creditMilliseconds,Math.floor((renewed.expires-now)/2));assert.equal(upgraded.expires,Date.UTC(2026,10,8,12)+upgraded.creditMilliseconds);assert.equal(plan('renewal'),'ultimate');assert.equal(plan('unrelated'),'basic');assert.throws(()=>redeemGiftKey(ultimate.key,'unrelated','friend'),/unavailable/);
 const downgrade=createGiftKey('plus','operator');assert.throws(()=>redeemGiftKey(downgrade.key,'renewal','friend'),/lower plan/);assert.equal(listGiftKeys().find(k=>k.id===downgrade.id).status,'unused');
 t.mock.method(Date,'now',()=>upgraded.expires);assert.equal(plan('renewal'),'basic');assert.equal(redeemGiftKey(downgrade.key,'renewal','friend').plan,'plus');
});
test.after(()=>{db.close();fs.rmSync(process.env.DATA_DIR,{recursive:true,force:true});});
