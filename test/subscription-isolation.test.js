import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'vex-isolation-'));
const {db,grant,plan}=await import('../src/db.js');
const {createGiftKey,redeemGiftKey}=await import('../src/licenses.js');
const {retireLegacyTrials}=await import('../src/subscription-isolation.js');
const trial=(guild,tier='ultimate',days=7)=>{const now=Date.now();grant(guild,tier,now+days*86400000);db.prepare('INSERT INTO incidents (guild,kind,json,at) VALUES (?,?,?,?)').run(guild,'trial_granted',JSON.stringify({actor:'operator',plan:tier,days}),now+1);};
test('old seven-day operator trials revert to Basic without changing the real gift server',()=>{
 const gift=createGiftKey('ultimate','operator'),result=redeemGiftKey(gift.key,'official','owner');trial('old-a');trial('old-b','plus');
 const retired=retireLegacyTrials(db);assert.deepEqual(retired.sort(),['old-a','old-b']);
 assert.equal(plan('old-a'),'basic');assert.equal(plan('old-b'),'basic');assert.equal(plan('official'),'ultimate');assert.equal(db.prepare('SELECT expires FROM entitlements WHERE guild=?').get('official').expires,result.expires);
 assert.equal(plan('unknown'),'basic');assert.equal(db.prepare('SELECT count(*) AS n FROM retired_trial_entitlements').get().n,2);
 assert.deepEqual(retireLegacyTrials(db),[]);
});
test('genuine renewed access, gift-backed rows and ambiguous trial records are preserved',()=>{
 trial('renewed');const expires=Date.now()+30*86400000;grant('renewed','ultimate',expires);
 trial('gift-after-trial');const gift=createGiftKey('ultimate','operator');redeemGiftKey(gift.key,'gift-after-trial','owner');
 trial('different-duration','ultimate',30);grant('no-trial','plus',expires);
 trial('wrong-tier');db.prepare("UPDATE incidents SET json=? WHERE guild='wrong-tier'").run(JSON.stringify({plan:'plus',days:7}));
 trial('bad-metadata');db.prepare("UPDATE incidents SET json='invalid' WHERE guild='bad-metadata'").run();
 assert.deepEqual(retireLegacyTrials(db),[]);
 for(const guild of ['renewed','gift-after-trial','different-duration','wrong-tier','bad-metadata'])assert.equal(plan(guild),'ultimate');assert.equal(plan('no-trial'),'plus');
 assert.equal(db.prepare('SELECT expires FROM entitlements WHERE guild=?').get('renewed').expires,expires);
});
test('one Ultimate key cannot grant access to any other server and expiry is guild-specific',t=>{
 const now=Date.UTC(2026,9,8,12);t.mock.method(Date,'now',()=>now);
 const gift=createGiftKey('ultimate','operator'),activation=redeemGiftKey(gift.key,'single-guild','owner');
 for(const guild of ['other-a','other-b','other-c'])assert.equal(plan(guild),'basic');
 assert.throws(()=>redeemGiftKey(gift.key,'other-a','owner'),/unavailable/);
 t.mock.method(Date,'now',()=>activation.expires);assert.equal(plan('single-guild'),'basic');
});
test.after(()=>{db.close();fs.rmSync(process.env.DATA_DIR,{recursive:true,force:true});});
