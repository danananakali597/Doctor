import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {Collection,Events} from 'discord.js';
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'vex-journey-'));
const {decorateWelcome,attachWelcomeJourney,journeyAction,journeyState}=await import('../src/welcome-journey.js');
const {saveSettings,getState}=await import('../src/db.js');
const owner='223456789012345678',g={id:'123456789012345678',channels:{cache:new Collection()}},m={id:owner,joinedTimestamp:100,user:{displayAvatarURL:()=> 'https://cdn.discordapp.com/embed/avatars/0.png'},roles:{cache:new Collection()}};
test('welcome links use configured channels and retain existing art',()=>{
 const cfg={journeyEnabled:true,sayHiEnabled:true,chatChannelId:'323456789012345678',rulesChannelId:'423456789012345678'};
 const art={embeds:[{image:{url:'https://example.org/art.png'}}],files:['original-image']};const p=decorateWelcome(art,g,cfg,m),controls=p.components.at(-1).toJSON().components;
 assert.equal(p.embeds,art.embeds);assert.equal(p.files,art.files);assert.ok(controls[0].url.endsWith(cfg.chatChannelId));assert.ok(controls[1].url.endsWith(cfg.rulesChannelId));assert.ok(controls[2].custom_id.endsWith(owner));
 assert.equal(decorateWelcome(art,g,{...cfg,sayHiEnabled:false},m).components.at(-1).toJSON().components.some(b=>b.label.includes('Say Hi')),false);
});
test('journey ownership is bound to recipient and old buttons are intercepted',()=>{
 assert.deepEqual(journeyAction({customId:'vex:journey:start:'+owner}),{action:'start',owner});
 assert.deepEqual(journeyAction({customId:'welcome:complete:'+owner,client:{user:{id:'bot'}},message:{author:{id:'bot'},components:[{components:[{customId:'welcome:complete:'+owner,label:'✅ Journey complete'}]}]}}),{action:'complete',owner});
});
test('only real human messages in configured channel advance introduction; rejoin resets milestones',()=>{
 const client=new EventEmitter();attachWelcomeJourney(client);saveSettings(g.id,{community:{welcome:{journeyEnabled:true,sayHiEnabled:true,chatChannelId:'chat'}}});
 client.emit(Events.MessageCreate,{guild:g,guildId:g.id,member:m,author:{bot:false},channelId:'other'});assert.equal(journeyState(g,m).state.intro,undefined);
 client.emit(Events.MessageCreate,{guild:g,guildId:g.id,member:m,author:{bot:true},channelId:'chat'});assert.equal(journeyState(g,m).state.intro,undefined);
 client.emit(Events.MessageCreate,{guild:g,guildId:g.id,member:m,author:{bot:false},channelId:'chat'});assert.equal(journeyState(g,m).state.intro,true);
 assert.equal(journeyState(g,{...m,joinedTimestamp:200}).state.intro,undefined);assert.equal(getState('other','welcome:journey:'+owner),null);
});
