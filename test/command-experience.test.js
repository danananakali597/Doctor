import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Client,Collection,PermissionsBitField,MessageFlagsBitField,PermissionFlagsBits as P,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,ContainerBuilder,ModalBuilder,TextInputBuilder,TextInputStyle} from 'discord.js';
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'vex-experience-'));
const {db,saveSettings}=await import('../src/db.js');
const {commandProfiles}=await import('../src/command-profiles.js');
const {presentCommand,componentCount,wrapCommandInteraction,commandForInteraction}=await import('../src/command-presentation.js');
const {commands}=await import('../src/commands.js');
const {cataloguePage,atlasPage,commandDetail,inputGuide,atlasInteraction,commandPaths}=await import('../src/command-atlas.js');
const {reviewInteraction,reviewFor,executeReview,pruneCommandReviews}=await import('../src/command-review.js');
const {rank}=await import('../src/community-store.js');
const {attachCommandExperience}=await import('../src/command-experience.js');
const {showcasePayload,refreshCommandShowcase}=await import('../src/command-showcase.js');
const {preferredGuild}=await import('../public/guild-memory.js');
const guildId='123456789012345678',owner='223456789012345678',target='323456789012345678',channelId='423456789012345678';
const actor={id:owner,permissions:new PermissionsBitField(P.Administrator),roles:{cache:new Collection()}};
const guild={id:guildId,members:{fetch:async()=>actor}};
const catalogue=Object.keys(commandProfiles).map((name,n)=>({...commands.find(c=>c.name===name),type:1,name,id:String(BigInt('723456789012345678')+BigInt(n)),description:'Guide for '+name}));
function i(commandName='commands'){
 const track={};return {guild,guildId,channelId,channel:{id:channelId,rateLimitPerUser:5},user:{id:owner},commandName,client:{application:{commands:{cache:new Collection(catalogue.map(c=>[c.id,c]))}}},options:{getString:()=>null,getUser:()=>({id:target}),getInteger:()=>200,getRole:()=>null,getChannel:()=>null},isChatInputCommand:()=>true,isButton:()=>false,
 deferReply:async function(){this.deferred=true;this.ephemeral=true;},deferUpdate:async function(){this.deferred=true;this.ephemeral=true;},editReply:async p=>{track.payload=p;},reply:async p=>{track.payload=p;},followUp:async p=>{track.payload=p;},update:async p=>{track.payload=p;},showModal:async m=>{track.modal=m;},track};
}
function click(id){const x=i();x.commandName=undefined;x.customId=id;x.isChatInputCommand=()=>false;x.message={flags:64};return x;}
const strings=cs=>(cs||[]).map(c=>[c.content||'',strings(c.components)].join('\n')).join('\n');
const ids=cs=>(cs||[]).flatMap(c=>[c.custom_id||'',...ids(c.components)]).filter(Boolean);
function validate(p){assert.ok(p.flags&32768);assert.equal(p.components[0].type,17);assert.ok(componentCount(p.components)<=40);assert.ok(strings(p.components).length<=4000);new ContainerBuilder(p.components[0]).toJSON();for(const id of ids(p.components))assert.ok(id.length<=100);}
saveSettings(guildId,{community:{levels:{enabled:true}}});
test('every registered command has an individual profile, workflow and native card',()=>{
 assert.equal(Object.keys(commandProfiles).length,44);for(const c of commands)assert.ok(commandProfiles[c.name],c.name);
 const layouts=new Set();for(const [name,p] of Object.entries(commandProfiles)){
  layouts.add(p.layout);assert.equal(p.steps.length,3);const out=presentCommand({embeds:[new EmbedBuilder().setTitle('Actual result').setDescription('Actual server data').addFields({name:'Value',value:'42'})]},name);validate(out);assert.match(strings(out.components),/Actual server data/);assert.equal(out.components[0].accent_color,p.color);
 }assert.equal(layouts.size,44);
});
test('native conversion preserves controls, mentions, evidence, images and attached files',()=>{
 const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('vex:roles:select').setStyle(ButtonStyle.Secondary).setLabel('Choose'));
 const p=presentCommand({embeds:[new EmbedBuilder().setTitle('Welcome').setDescription('True welcome').setImage('attachment://welcome.png').setThumbnail('https://cdn.discordapp.com/embed/avatars/0.png')],files:[{attachment:Buffer.from('image'),name:'welcome.png'},{attachment:Buffer.from('notes'),name:'notes.txt'}],components:[row],allowedMentions:{parse:[]}},'welcome');validate(p);assert.equal(p.components[1].components[0].custom_id,'vex:roles:select');assert.equal(p.files.length,2);assert.ok(JSON.stringify(p.components).includes('attachment://welcome.png'));assert.ok(JSON.stringify(p.components).includes('attachment://notes.txt'));assert.deepEqual(p.allowedMentions,{parse:[]});
});
test('oversized answers keep the whole result in a transcript and stay within Discord limits',()=>{
 const content='A'.repeat(7000)+'unique ending';const p=presentCommand({embeds:[{title:'AI response',description:content}]},'ask');validate(p);assert.equal(p.files.length,1);assert.ok(p.files[0].attachment.toString('utf8').endsWith('unique ending'));assert.ok(JSON.stringify(p.components).includes('attachment://vex-ask-'));
});
test('public shared panels, unknown commands and already native messages are preserved',()=>{
 const payload={embeds:[{title:'Shared ticket',description:'Staff view'}],components:[]};assert.equal(presentCommand(payload,'ticket',{privateResponse:false}),payload);assert.equal(presentCommand(payload,'unknown'),payload);const native=presentCommand(payload,'ticket');assert.equal(presentCommand(native,'ticket'),native);assert.equal(presentCommand({components:[]},'ticket').components.length,0);
});
test('cached private follow-up edits stay native and public webhook messages remain untouched',async()=>{
 const x=click('vex:journey:start:'+owner),edits=[];x.followUp=async()=>({id:'999999999999999999'});x.webhook={editMessage:async(id,p)=>edits.push({id,p})};wrapCommandInteraction(x);
 await x.followUp({embeds:[{title:'Welcome journey',description:'Read the rules'}],flags:64});await x.webhook.editMessage('999999999999999999',{embeds:[{title:'Progress',description:'Rules acknowledged'}]});validate(edits[0].p);
 const publicPayload={embeds:[{title:'Public announcement'}]};await x.webhook.editMessage('888888888888888888',publicPayload);assert.equal(edits[1].p,publicPayload);
});
test('interaction wrappers preserve private acknowledgement and modernize original modal labels',async()=>{
 const x=i('rank');wrapCommandInteraction(x);wrapCommandInteraction(x);await x.deferReply({flags:64});await x.editReply({embeds:[{title:'Rank',description:'Level 4 · 1600 XP'}]});validate(x.track.payload);assert.equal(x.track.payload.content,null);assert.deepEqual(x.track.payload.embeds,[]);
 const m=new ModalBuilder().setCustomId('vex:core:x:en:reason:y').setTitle('Reason').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(450)));await x.showModal(m);assert.equal(x.track.modal.components[0].type,18);assert.equal(x.track.modal.components[0].component.custom_id,'reason');assert.equal(x.track.modal.components[0].component.max_length,450);
 const publicClick=click('vex:ticket:test');publicClick.message.flags=0;wrapCommandInteraction(publicClick);const panel={embeds:[{title:'Public panel'}]};await publicClick.update(panel);assert.equal(publicClick.track.payload,panel);
});
test('all 44 commands are reachable through paging and category menus',()=>{
 let names=[];for(let page=0;page<3;page++)names.push(...cataloguePage(catalogue,'all',page).items.map(c=>c.name));assert.equal(new Set(names).size,44);
 for(const locale of ['en','ckb','ar','tr'])for(const group of ['all',...new Set(Object.values(commandProfiles).map(p=>p.group))]){
  const out=atlasPage(i(),{locale,group});for(const row of out.components){const r=row.toJSON();for(const c of r.components){assert.ok((c.custom_id||'').length<=100);assert.ok((c.options?.length||0)<=25);}}
  validate(presentCommand(out,'commands'));
 }
 assert.deepEqual(cataloguePage(catalogue,'all',0,'voice transfer').items.map(c=>c.name),['move']);
});
test('guides expose actual options, required inputs and registered slash mentions',()=>{
 const x=i();const out=commandDetail(x,actor,'setlevel');assert.match(out.embeds[0].data.description,/<\/setlevel:/);assert.match(out.embeds[0].data.fields.find(f=>f.name==='Inputs').value,/316/);assert.match(inputGuide([{name:'duration',type:4,required:true,description:'Minutes',min_value:1,max_value:40320}]),/Required/);
 actor.permissions=new PermissionsBitField(0n);const locked=commandDetail(x,actor,'setlevel');assert.match(locked.embeds[0].data.fields.find(f=>f.name==='Access').value,/permission required/);actor.permissions=new PermissionsBitField(P.Administrator);
});
test('nested subcommands and long input choices are retained rather than truncated',()=>{
 const paths=commandPaths({options:[{type:2,name:'channel',options:[{type:1,name:'configure',description:'Configure a destination',options:[{type:7,name:'channel',required:true}]}]}]});assert.equal(paths[0].name,'channel configure');assert.equal(paths[0].options[0].name,'channel');
 const c=catalogue.find(c=>c.name==='logs'),old=c.options;c.options=[{type:1,name:'configure',description:'Routing',options:[{name:'event',description:'Event',type:3,choices:Array.from({length:25},(_,n)=>({name:'Choice '+n,value:'x'.repeat(80)+n}))}]}];
 const detail=commandDetail(i(),actor,'logs');const fields=detail.embeds[0].data.fields.filter(f=>f.name.startsWith('Inputs'));assert.ok(fields.length>1);assert.ok(fields.map(f=>f.value).join('').includes('x'.repeat(80)+'24'));assert.match(detail.embeds[0].data.description,/<\/logs configure:/);c.options=old;
});
test('guild-aware settings links choose only installed, accessible dashboard servers',()=>{
 const guilds=[{id:'a',installed:true},{id:'b',installed:true},{id:'c',installed:false}];assert.equal(preferredGuild('u',guilds,'b').id,'b');assert.equal(preferredGuild('u',guilds,'c').id,'a');assert.equal(preferredGuild('u',guilds,'unavailable').id,'a');
});
test('public atlas launch creates a new private guide without editing the shared panel',async()=>{
 const x=click('vex:atlas:start');x.message.flags=32768;wrapCommandInteraction(x);await atlasInteraction(x);assert.equal(x.ephemeral,true);validate(x.track.payload);assert.equal(x.vexCommandName,'commands');
});
test('official command panel uses valid native payloads and updates the same message across boots',async()=>{
 const registered=new Collection(catalogue.map(c=>[c.id,c])),payload=showcasePayload(registered);assert.ok(componentCount(payload.components)<=40);for(const container of payload.components.filter(c=>c.type===17))new ContainerBuilder(container).toJSON();assert.match(strings(payload.components),/44 command experiences/);
 let sends=0,edits=0;const message={id:'999999999999999999',author:{id:'bot'},flags:new MessageFlagsBitField(32768),edit:async()=>{edits++;return message;}},channel={id:channelId,type:0,name:'commands',messages:{fetch:async()=>message},send:async()=>{sends++;return message;}};
 const client={user:{id:'bot'},guilds:{cache:new Collection([['1557341885649920002',{id:'1557341885649920002',channels:{cache:new Collection([[channelId,channel]])}}]])}};
 assert.equal((await refreshCommandShowcase(client,registered)).native,true);await refreshCommandShowcase(client,registered);assert.equal(sends,1);assert.equal(edits,2);
});
test('atlas controls are private and reject other invokers before fetching server data',async()=>{
 const x=i();await atlasInteraction(x);const custom=x.track.payload.components[0].components[0].data.custom_id;const foreign=click(custom);foreign.user={id:target};await atlasInteraction(foreign);assert.match(foreign.track.payload.content,/own private guide/);const search=click(custom.replace(':category:',':search:'));await atlasInteraction(search);assert.equal(search.track.modal.components[0].type,18);
});
test('XP reviews do not mutate before confirmation; double clicks execute exactly once',async()=>{
 const x=i('setxp');await reviewInteraction(x);assert.equal(rank(guildId,target).xp,0);const custom=x.track.payload.components[0].components[0].data.custom_id;const confirmation=click(custom);await Promise.all([reviewInteraction(confirmation),reviewInteraction(click(custom))]);assert.equal(rank(guildId,target).xp,200);assert.equal(db.prepare("SELECT count(*) n FROM incidents WHERE guild=? AND kind='xp_adjusted'").get(guildId).n,1);await reviewInteraction(click(custom));assert.equal(rank(guildId,target).xp,200);
});
test('review sessions bind owner, server, channel and expiry; cancel and fresh policy stop changes',async()=>{
 const x=i('setxp');x.options.getInteger=()=>300;await reviewInteraction(x);const custom=x.track.payload.components[0].components[0].data.custom_id,id=custom.split(':')[2];
 for(const changed of [{user:{id:target}},{guildId:'523456789012345678'},{channelId:'623456789012345678'}])assert.throws(()=>reviewFor(id,{...x,...changed}),/another/);
 saveSettings(guildId,{commandRules:{setxp:{enabled:false}}});await reviewInteraction(click(custom));assert.equal(rank(guildId,target).xp,200);saveSettings(guildId,{commandRules:{setxp:{enabled:true}}});
 const y=i('setxp');await reviewInteraction(y);const cancel=y.track.payload.components[0].components[1].data.custom_id;await reviewInteraction(click(cancel));await reviewInteraction(click(cancel.replace(':cancel',':confirm')));assert.equal(rank(guildId,target).xp,200);assert.throws(()=>reviewFor(id,x,Date.now()+200000),/expired/);pruneCommandReviews(Date.now()+200000);
});
test('fresh permission revocation and execution errors consume reviews without replay',async()=>{
 const x=i('setxp');await reviewInteraction(x);const id=x.track.payload.components[0].components[0].data.custom_id.split(':')[2],s=reviewFor(id,x);actor.permissions=new PermissionsBitField(0n);await assert.rejects(executeReview(x,s),/permissions/);assert.equal(s.state,'failed');actor.permissions=new PermissionsBitField(P.Administrator);await assert.rejects(executeReview(x,s),/already/);
 const y=i('setxp');await reviewInteraction(y);const state=reviewFor(y.track.payload.components[0].components[0].data.custom_id.split(':')[2],y);await assert.rejects(executeReview(y,state,async()=>{throw Error('Discord refused');}),/refused/);assert.equal(state.state,'failed');
});
test('experience router runs before existing handlers and leaves other workflows intact',async()=>{
 const client=new Client({intents:[]}),seen=[];client.on('interactionCreate',x=>{seen.push(x.commandName);assert.ok(x.editReply);});attachCommandExperience(client);attachCommandExperience(client);const other=i('rank');client.emit('interactionCreate',other);client.emit('interactionCreate',i('commands'));await new Promise(r=>setImmediate(r));assert.deepEqual(seen,['rank']);await client.destroy();
 const original=click('vex:core:'+owner+':en:rank:');assert.equal(commandForInteraction(original),'rank');
});
test.after(()=>{db.close();fs.rmSync(process.env.DATA_DIR,{recursive:true,force:true});});
