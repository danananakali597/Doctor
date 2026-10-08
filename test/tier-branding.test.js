import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {Collection,PermissionsBitField,PermissionFlagsBits as P,Client} from 'discord.js';
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'vex-branding-'));
const {db,grant,plan}=await import('../src/db.js');
const {TierBranding,attachTierBranding}=await import('../src/tier-branding.js');
const {tierBrandingProfile,tierNickname}=await import('../src/tier-branding-profiles.js');
const ids=['123456789012345678','223456789012345678','323456789012345678'],bot='423456789012345678';
function fixture({plans=['basic','plus','ultimate'],states=new Map(),actual=new Map(),clock=Date.now()}={}){
 const tiers=new Map(ids.map((id,n)=>[id,plans[n]])),patches=[],gets=[],logs=[];let now=clock,seq=0;
 const guilds=new Collection(ids.map(id=>[id,{id,available:true,members:{me:{permissions:new PermissionsBitField(P.Administrator)}}}]));
 for(const id of ids)if(!actual.has(id))actual.set(id,{nick:'Original VEX',avatar:null,user:{id:bot}});
 const client={user:{id:bot},guilds:{cache:guilds},isReady:()=>true,rest:{get:async route=>{gets.push(route);return {...actual.get(route.split('/')[2])};},patch:async(route,{body})=>{patches.push({route,body});const id=route.split('/')[2],previous=actual.get(id),result={...previous,nick:body.nick??previous.nick,avatar:body.avatar?'avatar-'+(++seq):previous.avatar};actual.set(id,result);return result;}}};
 const options={planFor:id=>tiers.get(id)||'basic',profileFor:tier=>({tier,nickname:tierNickname(tier),revision:tier+'-v1',avatar:'data:image/png;base64,'+Buffer.from(tier).toString('base64')}),readState:(id,key)=>states.get(id+'|'+key)||null,writeState:(id,key,value)=>states.set(id+'|'+key,value),now:()=>now,log:(name,value)=>logs.push({name,...value})};
 const service=new TierBranding(client,options);
 return {service,client,options,tiers,states,actual,patches,gets,logs,setNow:value=>{now=value;},now:()=>now};
}
test('production assets are three distinct valid square PNGs with stable fingerprints and exact nicknames',()=>{
 const hashes=new Set();for(const tier of ['basic','plus','ultimate']){const p=tierBrandingProfile(tier),bytes=Buffer.from(p.avatar.split(',')[1],'base64');assert.equal(bytes.readUInt32BE(16),bytes.readUInt32BE(20));assert.ok(bytes.length<8*1024*1024);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),p.revision);assert.equal(p.nickname,{basic:'VEX Basic',plus:'VEX Plus',ultimate:'VEX Ultimate'}[tier]);assert.equal(tierBrandingProfile(tier),p);hashes.add(p.revision);}assert.equal(hashes.size,3);assert.equal(tierBrandingProfile('invalid').tier,'basic');
});
test('each guild receives its own effective tier without touching the global bot account',async()=>{
 const f=fixture();await f.service.tick();assert.equal(f.patches.length,3);for(let n=0;n<ids.length;n++){const profile=f.actual.get(ids[n]);assert.equal(profile.nick,tierNickname(['basic','plus','ultimate'][n]));assert.ok(profile.avatar);assert.equal(f.patches[n].route,`/guilds/${ids[n]}/members/%40me`);}assert.ok(f.service.snapshot().every(s=>s.matched));assert.ok(f.patches.every(p=>!p.route.startsWith('/users/')));assert.ok(f.logs.every(l=>!JSON.stringify(l).includes('base64')));
});
test('buying Plus in one server leaves every other server unchanged',async()=>{
 const f=fixture({plans:['basic','basic','basic']});await f.service.tick();f.patches.length=0;f.tiers.set(ids[1],'plus');await f.service.tick();assert.equal(f.patches.length,1);assert.equal(f.patches[0].route,`/guilds/${ids[1]}/members/%40me`);assert.equal(f.actual.get(ids[0]).nick,'VEX Basic');assert.equal(f.actual.get(ids[1]).nick,'VEX Plus');assert.equal(f.actual.get(ids[2]).nick,'VEX Basic');
});
test('existing paid entitlement expiry resolves Basic using the same actual command-access plan resolver',async()=>{
 const f=fixture({plans:['basic','basic','basic']});f.service.planFor=plan;grant(ids[0],'ultimate',Date.now()+86400000);grant(ids[1],'plus',Date.now()+86400000);await f.service.tick();assert.equal(f.actual.get(ids[0]).nick,'VEX Ultimate');assert.equal(f.actual.get(ids[1]).nick,'VEX Plus');assert.equal(f.actual.get(ids[2]).nick,'VEX Basic');
 f.patches.length=0;grant(ids[0],'ultimate',Date.now()-1);await f.service.tick();assert.equal(f.patches.length,1);assert.equal(f.actual.get(ids[0]).nick,'VEX Basic');assert.equal(f.actual.get(ids[1]).nick,'VEX Plus');assert.equal(plan(ids[0]),'basic');
});
test('same-plan renewal, repeated ticks and concurrent queues do not reupload avatars',async()=>{
 const f=fixture();await Promise.all([f.service.tick(),f.service.tick(),f.service.request(ids[0])]);assert.equal(f.patches.length,3);await Promise.all([f.service.tick(),f.service.tick()]);assert.equal(f.patches.length,3);
});
test('restart verifies persisted guild avatars and nicknames instead of uploading them again',async()=>{
 const f=fixture();await f.service.tick();const second=new TierBranding(f.client,f.options);f.patches.length=0;await second.tick();assert.equal(f.patches.length,0);assert.ok(second.snapshot().every(s=>s.matched));assert.equal(f.logs.filter(l=>l.name==='VEX_TIER_BRANDING_VERIFIED').length,3);
 const backup=f.states.get(ids[0]+'|tier-branding:original');assert.equal(backup.nickname,'Original VEX');assert.equal(backup.avatar,null);
});
test('expiry while a paid avatar request is in flight is followed by the Basic identity',async()=>{
 const f=fixture();let unblock,started;const start=new Promise(resolve=>{started=resolve;}),wait=new Promise(resolve=>{unblock=resolve;}),patch=f.client.rest.patch;
 f.client.rest.patch=async(route,options)=>{if(route.includes(ids[2])&&options.body.nick==='VEX Ultimate'){started();await wait;}return patch(route,options);};
 const operation=f.service.tick();await start;f.tiers.set(ids[2],'basic');unblock();await operation;assert.equal(f.actual.get(ids[2]).nick,'VEX Basic');assert.equal(f.patches.filter(p=>p.route.includes(ids[2])).length,2);assert.ok(f.service.snapshot().every(s=>s.matched));
});
test('backoff survives queued duplicate attempts; a changed plan is re-evaluated immediately',async()=>{
 const f=fixture();const patch=f.client.rest.patch;let failures=0;f.client.rest.patch=async(route,body)=>{if(route.includes(ids[0])&&f.tiers.get(ids[0])==='basic'){failures++;throw Object.assign(Error('redacted'),{code:50013});}return patch(route,body);};
 await Promise.all([f.service.tick(),f.service.tick()]);assert.equal(failures,1);await f.service.tick();assert.equal(failures,1);f.setNow(f.now()+30000);await f.service.tick();assert.equal(failures,2);f.tiers.set(ids[0],'plus');await f.service.tick();assert.equal(f.actual.get(ids[0]).nick,'VEX Plus');assert.ok(f.service.matches(ids[0]));
});
test('missing Change Nickname permission applies the avatar once and retries only the name when restored',async()=>{
 const f=fixture();f.client.guilds.cache.get(ids[0]).members.me.permissions=new PermissionsBitField(0n);await f.service.tick();assert.ok(f.actual.get(ids[0]).avatar);assert.equal(f.actual.get(ids[0]).nick,'Original VEX');assert.equal(f.service.matches(ids[0]),false);assert.equal(f.patches.filter(p=>p.route.includes(ids[0])).length,1);f.setNow(f.now()+30000);await f.service.tick();assert.equal(f.patches.filter(p=>p.route.includes(ids[0])).length,1);
 const g=f.client.guilds.cache.get(ids[0]);g.members.me.permissions=new PermissionsBitField(P.Administrator);const actual=f.actual.get(ids[0]);f.service.observe({id:bot,guild:g,nickname:actual.nick,avatar:actual.avatar,permissions:g.members.me.permissions});await f.service.draining;
 const last=f.patches.at(-1);assert.equal(last.body.nick,'VEX Basic');assert.equal(last.body.avatar,undefined);assert.equal(f.service.matches(ids[0]),true);
});
test('external nickname drift is repaired without replacing the correct avatar',async()=>{
 const f=fixture();await f.service.tick();const g=f.client.guilds.cache.get(ids[1]),actual=f.actual.get(ids[1]);actual.nick='Changed by owner';f.service.observe({id:bot,guild:g,nickname:actual.nick,avatar:actual.avatar,permissions:g.members.me.permissions});await f.service.draining;assert.equal(f.patches.at(-1).body.avatar,undefined);assert.equal(f.patches.at(-1).body.nick,'VEX Plus');assert.equal(f.service.matches(ids[1]),true);
});
test('unknown guilds, unavailable guilds and non-bot member events cannot trigger profile writes',async()=>{
 const f=fixture();await f.service.request('523456789012345678');assert.equal(f.patches.length,0);f.service.observe({id:'523456789012345678',guild:{id:ids[0]}});assert.equal(f.patches.length,0);f.client.guilds.cache.get(ids[2]).available=false;await f.service.tick();assert.equal(f.patches.length,2);f.service.stop();await f.service.request(ids[2]);assert.equal(f.patches.length,2);
});
test('Discord responses that omit the avatar cannot be recorded as a successful profile change',async()=>{
 const f=fixture();f.client.rest.patch=async()=>({nick:'VEX Basic',avatar:null,user:{id:bot}});await f.service.tick();assert.ok(f.service.snapshot().every(s=>!s.matched));assert.ok(!f.states.has(ids[0]+'|tier-branding:v1'));assert.ok(f.logs.some(l=>l.name==='VEX_TIER_BRANDING_FAILED'));
});
test('branding attachment is idempotent and installed after subscription isolation in startup',async()=>{
 const c=new Client({intents:[]}),a=attachTierBranding(c);assert.equal(attachTierBranding(c),a);assert.equal(c.listeners('guildMemberUpdate').length,1);a.stop();await c.destroy();
 const source=fs.readFileSync(new URL('../src/index.js',import.meta.url),'utf8');assert.ok(source.indexOf('auditSubscriptionIsolation();')<source.indexOf('attachTierBranding(client);'));assert.ok(source.indexOf('attachTierBranding(client);')<source.indexOf('startBot().catch'));
});
test.after(()=>{db.close();fs.rmSync(process.env.DATA_DIR,{recursive:true,force:true});});
