import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {integrateExperienceWeb,integrateExperienceDashboard} from '../src/experience-runtime.js';
import {journeyProgress} from '../src/journey-state.js';
import {rememberGuild,preferredGuild} from '../public/guild-memory.js';
test('journey completion requires real introduction and rules acknowledgement',()=>{
 const c={sayHiEnabled:true,rulesChannelId:'123'};
 assert.equal(journeyProgress({},c,true).complete,false);
 assert.equal(journeyProgress({rules:true},c,true).complete,false);
 assert.equal(journeyProgress({rules:true,intro:true},c,false).complete,false);
 assert.equal(journeyProgress({rules:true,intro:true,roles:true},c,false).complete,true);
 assert.equal(journeyProgress({}, {sayHiEnabled:false},true).complete,true);
});
test('guild memory is per user and ignores unavailable guilds and storage failures',()=>{
 const map=new Map();globalThis.localStorage={setItem:(k,v)=>map.set(k,v),getItem:k=>map.get(k)};
 const guilds=[{id:'a',installed:true},{id:'b',installed:true},{id:'c',installed:false}];
 rememberGuild('u','b');assert.equal(preferredGuild('u',guilds).id,'b');assert.equal(preferredGuild('v',guilds).id,'a');
 rememberGuild('u','c');assert.equal(preferredGuild('u',guilds).id,'a');
 globalThis.localStorage={getItem:()=>{throw Error('disabled');},setItem:()=>{throw Error('disabled');}};
 assert.doesNotThrow(()=>rememberGuild('u','b'));assert.equal(preferredGuild('u',guilds).id,'a');delete globalThis.localStorage;
});
test('runtime integration removes trial endpoints but retains private gift access and is idempotent',()=>{
 const w=integrateExperienceWeb(fs.readFileSync('src/web.js','utf8'));
 assert.ok(!w.includes("app.post('/api/guilds/:id/trial'"));assert.ok(w.includes('permissions:P.Administrator.toString()'));assert.ok(w.includes('Only the server owner'));assert.ok(w.includes('attachGiftRoutes'));
 assert.equal(integrateExperienceWeb(w),w);
 const s=integrateExperienceDashboard(fs.readFileSync('public/app.js','utf8'));
 assert.ok(!s.includes('Operator test access'));assert.ok(!s.includes('/trial'));assert.ok(s.includes('giftKeysUI'));assert.ok(s.includes('preferredGuild(me.user.id'));
 assert.equal(integrateExperienceDashboard(s),s);
});
