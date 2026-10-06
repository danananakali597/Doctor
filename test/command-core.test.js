import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Collection,PermissionsBitField,PermissionFlagsBits as P,Client} from 'discord.js';
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'vex-core-'));
const {db,saveSettings}=await import('../src/db.js');
const {coreInteraction,buildCorePage,attachCommandCore,sessionFor,confirmAction,pruneSessions}=await import('../src/command-core.js');
const {commands}=await import('../src/commands.js');
const {integrateDashboard,integrateResponses}=await import('../src/command-runtime.js');
const {organizedNavigation,dashboardRoute,commandModule}=await import('../public/core-ui.js');
const g='123456789012345678',owner='223456789012345678',target='323456789012345678',channel='423456789012345678',role='523456789012345678';
let executions=0,failFetch=false;
const actor={id:owner,displayName:'Dana',permissions:new PermissionsBitField(P.Administrator),roles:{cache:new Collection(),highest:{comparePositionTo:()=>2}}};
const victim={id:target,displayName:'Alex',user:{username:'Alex'},roles:{highest:{}},moderatable:true,kickable:true,bannable:true,ban:async()=>{executions++;},kick:async()=>{executions++;},timeout:async()=>{executions++;}};
const ch={id:channel,type:0,permissionsFor:()=>new PermissionsBitField(P.Administrator)};
const guild={id:g,name:'VEX Test',ownerId:'623456789012345678',memberCount:15,members:{me:{id:'723456789012345678',permissions:new PermissionsBitField(P.Administrator)},fetch:async({user})=>{if(failFetch)throw Error('Discord membership lookup failed');return user===owner?actor:victim;}}};
function interaction(command='vex',options={}) {
 const track=[];
 return {guild,guildId:g,channel:ch,channelId:channel,user:{id:owner,username:'Dana'},client:{isReady:()=>true},locale:'en-US',commandName:command,deferred:false,replied:false,
 options:{getString:name=>options[name]??null,getUser:()=>({id:target}),getInteger:name=>options[name]??null,getBoolean:name=>options[name]??null},isChatInputCommand:()=>true,
 deferReply:async function(){this.deferred=true;track.push('defer');},editReply:async value=>{track.push('edit');track.payload=value;},reply:async value=>{track.push('reply');track.payload=value;},track};
}
function click(id,values){const i=interaction();i.commandName=undefined;i.customId=id;i.values=values;i.isChatInputCommand=()=>false;i.deferUpdate=async function(){this.deferred=true;i.track.push('update');};i.showModal=async m=>{i.track.modal=m;};return i;}
function confirmId(i){return i.track.payload.components[0].components[0].data.custom_id;}
saveSettings(g,{community:{moderation:{enabled:true},levels:{enabled:true}}});
test('core registration and native payloads fit Discord limits in all interface languages',()=>{
 assert.equal(commands.filter(c=>c.name==='vex').length,1);
 for(const locale of ['en','ckb','ar','tr'])for(const section of ['home','community','security','moderation','logs','support','voice','ai','games']){
  const payload=buildCorePage(interaction(),actor,section,locale);
  assert.deepEqual(payload.allowedMentions,{parse:[]});assert.ok(payload.embeds[0].toJSON());
  for(const row of payload.components){assert.ok(row.toJSON());assert.ok(row.components.length<=5);for(const c of row.components)assert.ok((c.data.custom_id||'').length<=100);}
 }
});
test('membership lookup happens after acknowledgement and failures get a useful reply',async()=>{
 const i=interaction();guild.members.fetch=async()=>{assert.equal(i.deferred,true);throw Error('Membership unavailable');};
 await coreInteraction(i);assert.deepEqual(i.track.slice(0,2),['defer','edit']);assert.match(i.track.payload.embeds[0].data.description,/Membership unavailable/);
 guild.members.fetch=async({user})=>user===owner?actor:victim;
});
test('ban previews have no side effect; concurrent confirmations create exactly one case',async()=>{
 executions=0;const i=interaction('ban',{reason:'Repeated spam'});await coreInteraction(i);assert.equal(executions,0);
 const id=confirmId(i),a=click(id),b=click(id);await Promise.all([coreInteraction(a),coreInteraction(b)]);
 assert.equal(executions,1);assert.equal(db.prepare("SELECT count(*) AS n FROM mod_cases WHERE guild=? AND action='ban'").get(g).n,1);
 const done=[a,b].find(x=>x.track.payload.embeds[0].data.title==='Action completed');assert.ok(done);
 const view=click(done.track.payload.components[0].components[0].data.custom_id);await coreInteraction(view);assert.match(view.track.payload.embeds[0].data.title,/CASE #/);
 await coreInteraction(click(id));assert.equal(executions,1);
});
test('confirmation rejects role policy changes made after preview',async()=>{
 const i=interaction('kick');await coreInteraction(i);saveSettings(g,{commandRules:{kick:{enabled:false}}});
 const before=executions,confirmation=click(confirmId(i));await coreInteraction(confirmation);assert.equal(executions,before);assert.match(confirmation.track.payload.embeds[0].data.description,/disabled/);
 saveSettings(g,{commandRules:{kick:{enabled:true}}});
});
test('confirmation rejects revoked permissions, hierarchy changes and module disable',async()=>{
 for(const kind of ['permission','hierarchy','module']) {
  const i=interaction('timeout',{minutes:10});await coreInteraction(i);const before=executions;
  if(kind==='permission')actor.permissions=new PermissionsBitField(0n);
  if(kind==='hierarchy')victim.moderatable=false;
  if(kind==='module')saveSettings(g,{community:{moderation:{enabled:false}}});
  await coreInteraction(click(confirmId(i)));assert.equal(executions,before);
  actor.permissions=new PermissionsBitField(P.Administrator);victim.moderatable=true;saveSettings(g,{community:{moderation:{enabled:true}}});
 }
});
test('sessions cannot cross invokers, guilds, channels or expiry; cancel prevents execution',async()=>{
 const i=interaction('kick');await coreInteraction(i);const custom=confirmId(i),id=custom.split(':')[5],before=executions;
 for(const changed of [{guildId:'823456789012345678'},{channelId:'923456789012345678'},{user:{id:target}}]){
  assert.throws(()=>sessionFor(id,{...i,...changed}),/another session/);
 }
 const cancel=click(custom.replace(':confirm:',':cancel:'));await coreInteraction(cancel);await coreInteraction(click(custom));assert.equal(executions,before);
 assert.throws(()=>sessionFor(id,i,Date.now()+10000000),/expired/);pruneSessions(Date.now()+10000000);
});
test('wizard member selection and modal submission stay in one message and verify access again',async()=>{
 const start=click(`vex:core:${owner}:ckb:start:`);await coreInteraction(start);const memberMenu=start.track.payload.components[0].components[0].data.custom_id;
 const selected=click(memberMenu,[target]);await coreInteraction(selected);const actionMenu=selected.track.payload.components[0].components[0].data.custom_id;
 const choice=click(actionMenu,['timeout']);await coreInteraction(choice);assert.ok(choice.track.modal);
 const submit=click(choice.track.modal.data.custom_id);submit.fields={getTextInputValue:n=>n==='minutes'?'15':'Spam'};
 await coreInteraction(submit);assert.ok(submit.track.includes('update'));assert.match(submit.track.payload.embeds[0].data.title,/پێداچوونەوە/);
 const confirmation=click(confirmId(submit));await coreInteraction(confirmation);assert.match(confirmation.track.payload.embeds[0].data.title,/تەواو/);
});
test('member controls cannot expose moderator casebooks or private log records',async()=>{
 const member={...actor,permissions:new PermissionsBitField(0n)};assert.throws(()=>buildCorePage(interaction(),member,'logs'),/Manage Server/);
 const page=buildCorePage(interaction(),member,'moderation');assert.ok(!JSON.stringify(page).includes('vex:core:'+owner+':en:cases'));
 const i=click(`vex:core:${owner}:en:cases:`);actor.permissions=new PermissionsBitField(0n);await coreInteraction(i);assert.match(i.track.payload.embeds[0].data.description,/permissions/);actor.permissions=new PermissionsBitField(P.Administrator);
});
test('core router suppresses only its handled commands and preserves other runtime modules',async()=>{
 const client=new Client({intents:[]});const seen=[];client.on('interactionCreate',i=>seen.push(i.commandName));attachCommandCore(client);attachCommandCore(client);
 client.emit('interactionCreate',{...interaction('ask')});client.emit('interactionCreate',interaction('vex'));await new Promise(r=>setImmediate(r));assert.deepEqual(seen,['ask']);await client.destroy();
});
test('runtime transforms are idempotent and preserve installed AI/cinema handlers',()=>{
 const base=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');const installed=base.replace("else if(page==='overview')","else if(page==='ai-chat')aiDashboard(root);else if(page==='overview')");
 const first=integrateDashboard(installed);assert.equal(integrateDashboard(first),first);assert.match(first,/aiDashboard/);assert.match(first,/commandDirectory/);
 const handlers="client.on('interactionCreate',async i=>{if(i.isChatInputCommand()){await verify();await i.reply({content:'Denied'});}await i.deferReply({flags:64});});";
 const patched=integrateResponses(handlers,{early:true});assert.equal(integrateResponses(patched,{early:true}),patched);assert.ok(patched.indexOf('await deferPrivate(i)')<patched.indexOf('await verify()'));
});
test('dashboard has one destination for each module and rejects unsupported deep links',()=>{
 const groups=[['x',[['overview','x','Overview'],['community:welcome','x','Welcome'],['community:goodbye','x','Leave'],['access','x','Access'],['ai-security','x','AI Security'],['serverlogs','x','Logs'],['community:tickets','x','Tickets'],['ai-chat','x','AI'],['community:cinema','x','Cinema'],['access','x','duplicate']]]];
 const organized=organizedNavigation(groups),ids=organized.flatMap(([,items])=>items.map(x=>x[0]));assert.equal(ids.length,new Set(ids).size);
 assert.ok(organized.find(([g])=>g==='SECURITY')[1].some(x=>x[0]==='access'));assert.equal(commandModule('ban'),'community:moderation');
 const data={communityModules:[{id:'welcome'}],modules:[{id:'spam'}],commands:[]};assert.equal(dashboardRoute('community:welcome',data),'community:welcome');assert.equal(dashboardRoute('javascript:bad',data),'overview');assert.equal(dashboardRoute('community:missing',data),'overview');
});

test('lockdown reviews require ownership and preserve the ability to restore after tier expiry',async()=>{
 const ordinary=interaction('lockdown',{enabled:true});await coreInteraction(ordinary);assert.match(ordinary.track.payload.embeds[0].data.description,/owner required/);
 const old=guild.ownerId;guild.ownerId=owner;const noTier=interaction('lockdown',{enabled:true});await coreInteraction(noTier);assert.match(noTier.track.payload.embeds[0].data.description,/Ultimate/);
 const restore=interaction('lockdown',{enabled:false});await coreInteraction(restore);assert.match(restore.track.payload.embeds[0].data.fields[0].value,/RESTORE ACCESS/);
 await coreInteraction(click(confirmId(restore)));guild.ownerId=old;
});

test.after(()=>{db.close();fs.rmSync(process.env.DATA_DIR,{recursive:true,force:true});});
