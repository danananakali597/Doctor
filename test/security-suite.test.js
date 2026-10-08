import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Collection,PermissionFlagsBits as P} from 'discord.js';
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'vex-security-suite-'));
process.env.OPENAI_API_KEY='mock-key-not-a-real-credential';
const {settings,saveSettings,grant,events,db}=await import('../src/db.js');
const {validatePatch}=await import('../src/catalog.js');
const {securitySuiteDefaults}=await import('../src/security-suite-config.js');
const {reserveReview,settleReview,budgetStatus}=await import('../src/security-budget.js');
const {classifySecurity,moderationInput}=await import('../src/security-openai.js');
const {active,attachSecurity}=await import('../src/security.js');
const {inspectSecurityAI,releaseSecurityTimeout}=await import('../src/security-suite.js');
const g='123456789012345678',u='223456789012345678';
const cfg=()=>({...securitySuiteDefaults().ai,paidReview:true});
const fake=(score=.5,review={violation:true,confidence:.95,reason:'targeted harassment'})=>async(url,opts)=>{const body=JSON.parse(opts.body);if(url.endsWith('/moderations'))return {ok:true,json:async()=>({results:[{category_scores:{harassment:score}}]})};assert.equal(body.model,'gpt-4.1-mini');assert.equal(body.max_completion_tokens,160);assert.equal(body.response_format.json_schema.strict,true);return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(review)}}],usage:{prompt_tokens:500,completion_tokens:50}})};};
test('configuration is owner-only, rejects unknown settings and keeps partial AI updates',()=>{
 assert.throws(()=>validatePatch({securitySuite:{mode:'monitor'}},'ultimate',false),/owner/);
 assert.throws(()=>validatePatch({securitySuite:{ai:{enabled:true}}},'basic',true),/Ultimate/);
 assert.throws(()=>validatePatch({securitySuite:{ai:{monthlyBudgetCents:-1}}},'ultimate',true),/limit/);
 assert.throws(()=>validatePatch({securitySuite:{ai:{endpoint:'http://localhost'}}},'ultimate',true),/Unknown/);
 saveSettings(g,{securitySuite:{mode:'monitor',ai:{images:true}}});saveSettings(g,{securitySuite:{ai:{monthlyBudgetCents:100}}});const c=settings(g).securitySuite;assert.equal(c.mode,'monitor');assert.equal(c.ai.images,true);assert.equal(c.ai.monthlyBudgetCents,100);assert.equal(c.ai.enabled,false);
});
test('reservations enforce one global cap across guilds and cannot be refunded twice',()=>{
 process.env.VEX_SECURITY_AI_MONTHLY_BUDGET_USD='0.001';const c=cfg(),a=reserveReview('budget-a',c,600);assert.ok(a);assert.equal(reserveReview('budget-b',c,600),null);settleReview(a,400);settleReview(a,0);assert.equal(budgetStatus('budget-a',c).usedMicros,400);assert.ok(reserveReview('budget-b',c,600));assert.equal(reserveReview('budget-c',c,1),null);
});
test('daily cap is persistent and lowering a budget blocks new reservations',()=>{
 process.env.VEX_SECURITY_AI_MONTHLY_BUDGET_USD='5';const c={...cfg(),maxPaidReviewsPerDay:1};const a=reserveReview('daily',c,100);assert.ok(a);settleReview(a,null);assert.equal(reserveReview('daily',c,100),null);assert.equal(budgetStatus('daily',c).dailyReviews,1);assert.equal(reserveReview('zero',{...c,monthlyBudgetCents:0},1),null);
});
test('clear moderation uses no paid call, duplicates are cached, cache is guild-isolated',async()=>{
 let calls=0;const fetcher=async(...args)=>{calls++;return fake(.98)(...args)};const c=cfg();const a=await classifySecurity('clear',c,{content:'unique clear content'},fetcher);assert.equal(a.violation,true);assert.equal(a.source,'moderation');assert.equal(calls,1);assert.equal((await classifySecurity('clear',c,{content:'unique clear content'},fetcher)).cached,true);assert.equal(calls,1);await classifySecurity('other',c,{content:'unique clear content'},fetcher);assert.equal(calls,2);
});
test('paid review uses measured usage and zero budget leaves borderline cases for review',async()=>{
 process.env.VEX_SECURITY_AI_MONTHLY_BUDGET_USD='5';const c=cfg();const a=await classifySecurity('paid',c,{content:'unique borderline'},fake());assert.equal(a.violation,true);assert.equal(a.source,'paid_review');assert.equal(budgetStatus('paid',c).usedMicros,280);
 let calls=0;const b=await classifySecurity('blocked',{...c,monthlyBudgetCents:0},{content:'unique blocked'},async(...args)=>{calls++;return fake()(...args)});assert.equal(b.reviewStatus,'budget_limited');assert.equal(b.violation,false);assert.equal(b.needsReview,true);assert.equal(calls,1);
});
test('malformed or unavailable API checks never fabricate AI guilt',async()=>{
 assert.equal((await classifySecurity('error',cfg(),{content:'network error'},async()=>{throw Error('network')})).status,'unavailable');
 const r=await classifySecurity('malformed',cfg(),{content:'bad output'},fake(.5,{violation:'yes',confidence:2,reason:'bad'}));assert.equal(r.violation,false);assert.equal(r.reviewStatus,'unavailable');
});
test('custom paid policy cannot cancel a clear moderation signal',async()=>{
 const r=await classifySecurity('policy', {...cfg(),policy:'No advertising'}, {content:'unique policy'}, fake(.99,{violation:false,confidence:.95,reason:'allowed'}));assert.equal(r.violation,true);assert.equal(r.source,'moderation');
});
test('image requests allow only bounded Discord-hosted images and never arbitrary URLs',()=>{
 const attachments=[{url:'https://cdn.discordapp.com/a.png',contentType:'image/png',size:1000},{url:'http://127.0.0.1/image.png',contentType:'image/png',size:10},{url:'https://cdn.discordapp.com/huge.png',contentType:'image/png',size:30*1024*1024}];assert.equal(moderationInput('',attachments,true).length,1);assert.equal(moderationInput('',attachments,false).length,0);
});
test('monitoring suppresses legacy message, join, voice and audit responses',async()=>{
 grant(g,'ultimate',Date.now()+600000);saveSettings(g,{securitySuite:{mode:'monitor'},modules:{spam:{enabled:true,action:'timeout'},verification:{enabled:true},nuke:{enabled:true,action:'strip'},voice:{enabled:true,action:'disconnect'}}});assert.equal(active(g,'spam').action,'log');assert.equal(active(g,'nuke').action,'log');
 const handlers=new Map();attachSecurity({on:(name,fn)=>handlers.set(name,fn),user:{id:'bot'}});let timeout=0,kick=0;const member={id:u,user:{bot:false},guild:{id:g,ownerId:'owner',channels:{cache:new Collection()},fetchOwner:async()=>null},client:{user:{id:'bot'}},roles:{cache:new Collection()},timeout:async()=>timeout++,kick:async()=>kick++,moderatable:true};handlers.get('guildMemberAdd')(member);await new Promise(resolve=>setTimeout(resolve,25));assert.equal(timeout,0);assert.equal(kick,0);assert.ok(events(g).some(e=>e.kind==='join_protection'&&e.detail.result==='logged'));
 saveSettings(g,{securitySuite:{mode:'paused'}});assert.equal(active(g,'spam'),null);assert.ok(active(g,'logs'));
});
test('AI enforcement rechecks mode after the request and records uncertain cases without deletion',async()=>{
 const original=global.fetch;grant(g,'ultimate',Date.now()+600000);saveSettings(g,{securitySuite:{mode:'enforce',ai:{enabled:true,action:'timeout',paidReview:false}}});let deleted=0;
 const member={id:u,roles:{cache:new Collection()},moderatable:true};const m={guildId:g,id:'message1',content:'check race',editedTimestamp:null,author:{id:u},channelId:'channel',attachments:new Collection(),guild:{id:g,ownerId:'owner',members:{fetch:async()=>member}},channel:{messages:{fetch:async()=>m}},delete:async()=>deleted++};
 try{global.fetch=async(...args)=>{saveSettings(g,{securitySuite:{mode:'monitor'}});return fake(.99)(...args)};await inspectSecurityAI(m,settings(g),async()=>{});assert.equal(deleted,0);
 let details;global.fetch=fake(.5);m.id='message2';m.content='uncertain unique';await inspectSecurityAI(m,settings(g),async(_g,kind,detail)=>{details={kind,detail}});assert.equal(deleted,0);assert.equal(details.kind,'ai_security_incident');assert.equal(details.detail.result,'review only');
 }finally{global.fetch=original;}
});
test('changed messages cannot be punished using an earlier classification',async()=>{
 const original=global.fetch;saveSettings(g,{securitySuite:{mode:'enforce'}});let deleted=0,recorded=0;const m={guildId:g,id:'edited1',content:'old message',editedTimestamp:null,author:{id:u},channelId:'channel',attachments:new Collection(),guild:{id:g,ownerId:'owner'},channel:{messages:{fetch:async()=>({...m,content:'edited safe message',editedTimestamp:123})}},delete:async()=>deleted++};try{global.fetch=fake(.99);await inspectSecurityAI(m,settings(g),async()=>recorded++);assert.equal(deleted,0);assert.equal(recorded,0);}finally{global.fetch=original;}
});
test.after(()=>db.close());
