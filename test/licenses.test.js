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
test('same-tier gifts extend access; different active tiers do not consume the key or overwrite access',t=>{
 const now=Date.UTC(2026,9,8,12);t.mock.method(Date,'now',()=>now);
 const existing=Date.UTC(2026,9,20,12);grant('renewal','plus',existing);
 const plus=createGiftKey('plus','operator');assert.equal(redeemGiftKey(plus.key,'renewal','friend').expires,Date.UTC(2026,10,20,12));
 const ultimate=createGiftKey('ultimate','operator');assert.throws(()=>redeemGiftKey(ultimate.key,'renewal','friend'),/current plan/);
 assert.equal(plan('renewal'),'plus');assert.equal(listGiftKeys().find(k=>k.id===ultimate.id).status,'unused');
 grant('renewal','plus',now);assert.equal(redeemGiftKey(ultimate.key,'renewal','friend').plan,'ultimate');
});
test.after(()=>{db.close();fs.rmSync(process.env.DATA_DIR,{recursive:true,force:true});});
