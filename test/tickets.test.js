import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {Collection,PermissionsBitField,PermissionFlagsBits as P} from 'discord.js';
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'vex-tickets-'));
const {saveSettings,db}=await import('../src/db.js');
const {attachTicketInteractions,handleTicketInteraction,ticketPanel,ticketCard,publishTicketPanel}=await import('../src/tickets.js');
const ids={guild:'123456789012345678',support:'223456789012345678',category:'323456789012345678',panel:'423456789012345678',owner:'523456789012345678',staff:'623456789012345678',other:'723456789012345678',bot:'823456789012345678',ticket:'923456789012345678'};
const member=(id,staff=false)=>({id,user:{id,bot:false},permissions:new PermissionsBitField(0n),roles:{cache:new Collection(staff?[[ids.support,{id:ids.support}]]:[])}});
const people=new Map([[ids.owner,member(ids.owner)],[ids.staff,member(ids.staff,true)],[ids.other,member(ids.other)]]);
const guild={id:ids.guild,channels:{cache:new Collection()},roles:{cache:new Collection([[ids.support,{id:ids.support}]])},members:{me:{id:ids.bot,permissions:new PermissionsBitField(P.Administrator)},fetch:async arg=>people.get(typeof arg==='string'?arg:arg.user)}};
guild.channels.cache.set(ids.category,{id:ids.category,type:4,permissionsFor:()=>new PermissionsBitField(P.Administrator)});
const payloads=[],edits=[],permissions=[];let creates=0;
const board={id:'board',author:{id:ids.bot},edit:async p=>{edits.push(p);return board;}};
const channel={id:ids.ticket,guild,permissionsFor:()=>new PermissionsBitField(P.Administrator),permissionOverwrites:{edit:async(id,values)=>permissions.push({id,values})},messages:{fetch:async()=>board},send:async p=>{payloads.push(p);return board;}};
guild.channels.create=async args=>{creates++;assert.equal(args.name,'ticket-0001');assert.equal(args.parent,ids.category);assert.ok(args.permissionOverwrites.find(x=>x.id===ids.guild).deny.includes(P.ViewChannel));assert.ok(args.permissionOverwrites.find(x=>x.id===ids.owner).allow.includes(P.ViewChannel));assert.ok(args.permissionOverwrites.find(x=>x.id===ids.bot).allow.includes(P.AttachFiles));guild.channels.cache.set(channel.id,channel);return channel;};
saveSettings(ids.guild,{community:{tickets:{enabled:true,categoryId:ids.category,channelId:ids.panel,supportRoleId:ids.support}}});
function interaction(customId,user=ids.owner,extra={}){const i={customId,guild,guildId:ids.guild,user:{id:user},channelId:ids.ticket,channel,message:board,isStringSelectMenu:()=>false,isUserSelectMenu:()=>false,isModalSubmit:()=>false,isButton:()=>false,isChatInputCommand:()=>false,reply:async p=>{i.output=p;i.replied=true;},deferReply:async()=>{i.deferred=true;},editReply:async p=>{i.output=p;},showModal:async p=>{i.modal=p;},...extra};return i;}
const desc=i=>i.output.embeds[0].data.description;
test('panel and ticket payloads serialize with the reference layout and actual image files',()=>{
 const panel=ticketPanel();assert.equal(panel.embeds[1].data.title,'Support Center');assert.equal(panel.components[0].toJSON().components[0].options.length,3);assert.equal(panel.components[0].toJSON().components[0].placeholder,'Select a support topic');assert.ok(fs.existsSync(panel.files[0].attachment));
 const card=ticketCard({user:ids.owner,status:'open',claimed:ids.staff},{number:42,topic_type:'technical',topic:'Welcome message is not working'});
 assert.equal(card.embeds[0].toJSON().title,'Ticket #0042');assert.equal(card.embeds[0].data.color,0x3498db);assert.deepEqual(card.embeds[0].data.fields.map(f=>[f.name,f.inline]),[['Owner',true],['Assigned to',true],['Topic',false],['Status',false]]);assert.deepEqual(card.components[0].toJSON().components.map(x=>x.label),['Claim','Transfer','Close']);assert.ok(fs.existsSync(card.files[0].attachment));
});
test('topic selection opens a request form and creates no channel until submission',async()=>{
 const i=interaction('vex:ticket:topic',ids.owner,{values:['technical'],isStringSelectMenu:()=>true});await handleTicketInteraction(i);assert.equal(i.modal.toJSON().custom_id,'vex:ticket:request:technical');assert.equal(creates,0);
});
test('form creates one private numbered ticket and duplicate submission reuses it',async()=>{
 const make=()=>interaction('vex:ticket:request:technical',ids.owner,{isModalSubmit:()=>true,fields:{getTextInputValue:key=>key==='subject'?'Welcome problem':'Private request details'}});
 const i=make();await handleTicketInteraction(i);assert.match(desc(i),/ready/);assert.equal(creates,1);assert.equal(payloads[0].embeds[0].data.title,'Ticket #0001');assert.equal(payloads[0].embeds[0].data.fields[3].value,'Waiting for support');assert.ok(!JSON.stringify(db.prepare('SELECT * FROM ticket_details').all()).includes('Private request details'));
 const duplicate=make();await handleTicketInteraction(duplicate);assert.match(desc(duplicate),/already have an open ticket/);assert.equal(creates,1);
});
test('nonstaff cannot claim or transfer; staff assignment edits the same card',async()=>{
 const intruder=interaction('vex:ticket:claim',ids.other,{isButton:()=>true});await handleTicketInteraction(intruder);assert.match(desc(intruder),/staff permission/);assert.equal(edits.length,0);
 const staff=interaction('vex:ticket:claim',ids.staff,{isButton:()=>true});await handleTicketInteraction(staff);assert.match(desc(staff),/Assigned/);assert.equal(edits.length,1);assert.equal(edits[0].embeds[0].data.fields[1].value,`<@${ids.staff}>`);assert.equal(edits[0].embeds[0].data.color,0x3498db);
 const transfer=interaction('vex:ticket:transfer',ids.staff,{isButton:()=>true});await handleTicketInteraction(transfer);assert.equal(transfer.output.components[0].toJSON().components[0].custom_id,'vex:ticket:assign:'+ids.ticket);
 const nonstaff=interaction('vex:ticket:assign:'+ids.ticket,ids.staff,{isUserSelectMenu:()=>true,values:[ids.other]});await handleTicketInteraction(nonstaff);assert.match(desc(nonstaff),/current member/);assert.equal(db.prepare('SELECT claimed FROM community_tickets').get().claimed,ids.staff);
 people.set(ids.other,member(ids.other,true));const assigned=interaction('vex:ticket:assign:'+ids.ticket,ids.staff,{isUserSelectMenu:()=>true,values:[ids.other]});await handleTicketInteraction(assigned);assert.match(desc(assigned),/Transferred/);assert.equal(edits.at(-1).embeds[0].data.fields[1].value,`<@${ids.other}>`);
});
test('close preserves read access and the card; only staff can reopen',async()=>{
 const close=interaction('vex:ticket:close',ids.owner,{isButton:()=>true});await handleTicketInteraction(close);assert.match(desc(close),/preserved/);assert.deepEqual(permissions.at(-1),{id:ids.owner,values:{SendMessages:false}});assert.equal(edits.at(-1).embeds[0].data.color,0x2ecc71);assert.equal(edits.at(-1).components[0].toJSON().components[2].label,'Reopen');
 const denied=interaction('vex:ticket:reopen',ids.owner,{isButton:()=>true});await handleTicketInteraction(denied);assert.match(desc(denied),/staff permission/);
 const reopen=interaction('vex:ticket:reopen',ids.staff,{isButton:()=>true});await handleTicketInteraction(reopen);assert.equal(db.prepare('SELECT status FROM community_tickets').get().status,'open');assert.deepEqual(permissions.at(-1).values,{SendMessages:true});
});
test('forms recheck current command access and transfer menus cannot cross tickets or guilds',async()=>{
 saveSettings(ids.guild,{commandRules:{ticket:{enabled:false}}});const blocked=interaction('vex:ticket:topic',ids.owner,{values:['technical'],isStringSelectMenu:()=>true});await handleTicketInteraction(blocked);assert.match(desc(blocked),/disabled in the dashboard/);assert.equal(blocked.modal,undefined);saveSettings(ids.guild,{commandRules:{ticket:{enabled:true}}});
 const wrong=interaction('vex:ticket:assign:other-channel',ids.staff,{values:[ids.other],isUserSelectMenu:()=>true});await handleTicketInteraction(wrong);assert.match(desc(wrong),/another ticket/);
 const foreign=interaction('vex:ticket:claim',ids.staff,{guildId:'another-guild',isButton:()=>true});await handleTicketInteraction(foreign);assert.match(desc(foreign),/not a VEX ticket/);
});
test('republishing updates the saved panel without duplicate messages',async()=>{
 let sends=0,panelEdits=0;const messages=new Map();const panel={id:ids.panel,permissionsFor:()=>new PermissionsBitField(P.Administrator),messages:{fetch:async id=>messages.get(id)},send:async()=>{const id='message-'+(++sends),m={id,url:'https://discord.com/channels/example/'+id,author:{id:ids.bot},edit:async()=>{panelEdits++;}};messages.set(id,m);return m;}};
 await publishTicketPanel(guild,panel);await publishTicketPanel(guild,panel);assert.equal(sends,2);assert.equal(panelEdits,2);
});
test('ticket router suppresses only legacy ticket dispatch while preserving other interactions',async()=>{
 const client=new EventEmitter();let legacy=0;client.on('interactionCreate',()=>{legacy++;});attachTicketInteractions(client);attachTicketInteractions(client);
 const i=interaction('vex:ticket:unknown',ids.owner,{isButton:()=>true});client.emit('interactionCreate',i);await new Promise(r=>setImmediate(r));assert.equal(legacy,0);assert.match(desc(i),/staff permission/);
 client.emit('interactionCreate',{guild,customId:'vex:roles:select',isChatInputCommand:()=>false});assert.equal(legacy,1);
});
test.after(()=>{db.close();fs.rmSync(process.env.DATA_DIR,{recursive:true,force:true});});
