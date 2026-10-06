import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PermissionsBitField,PermissionFlagsBits as P,ChannelType} from 'discord.js';
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'vex-extra-'));
const {extraCommands,giveReputation,reputation,changePoints,points,setXP,activeWarnings,commandGuide,extraInteraction}=await import('../src/extra-commands.js');
const {commands}=await import('../src/commands.js');
const {db,getState}=await import('../src/db.js');
const g='123456789012345678',a='223456789012345678',b='323456789012345678';

test('Discord registration has unique valid commands and required options first',()=>{
 const names=commands.map(x=>x.name);assert.equal(names.length,new Set(names).size);
 for(const command of commands){let optionalSeen=false;for(const option of command.options||[]){if(option.required&&optionalSeen)assert.fail(`${command.name} has a required option after an optional one`);if(!option.required)optionalSeen=true;}}
 assert.ok(extraCommands.length>=20);
});
test('reputation is bounded by 24 hours and isolated per server and actor',()=>{
 assert.throws(()=>giveReputation(g,a,a,100000000));
 assert.equal(giveReputation(g,a,b,100000000),1);
 assert.throws(()=>giveReputation(g,a,b,100001000),/24 hours/);
 assert.equal(giveReputation(g,'423456789012345678',b,100001000),2);
 assert.equal(reputation('other',b),0);
 assert.equal(giveReputation(g,a,b,186400000),3);
});
test('points, XP and warning retraction remain scoped and auditable',()=>{
 assert.equal(changePoints(g,b,'add',55),55);
 assert.equal(changePoints(g,b,'remove',100),0);
 assert.equal(points('other',b),0);
 assert.throws(()=>changePoints(g,b,'add',1001));
 assert.equal(setXP(g,b,900).level,3);
 assert.equal(setXP('other',b,0).level,0);
 const id=Number(db.prepare('INSERT INTO mod_cases(guild,actor,target,action,reason,at) VALUES(?,?,?,?,?,?)').run(g,a,b,'warn','Reason',Date.now()).lastInsertRowid);
 assert.equal(activeWarnings(g,b)[0].id,id);
 db.prepare('INSERT INTO mod_cases(guild,actor,target,action,reason,at) VALUES(?,?,?,?,?,?)').run(g,a,b,'warn_retracted',`Retracted warning #${id}`,Date.now());
 assert.equal(activeWarnings(g,b).length,0);
 assert.equal(db.prepare('SELECT action FROM mod_cases WHERE id=?').get(id).action,'warn');
});
test('guide buttons open the actual categories and retain safe embeds',async()=>{
 let response;const i={guildId:g,customId:'vex:guide:team',isButton:()=>true,update:async value=>{response=value;}};
 assert.equal(await extraInteraction(i),true);
 assert.match(response.embeds[0].data.description,/permissions/);
 assert.match(response.embeds[0].data.fields[0].value,/\/warn/);
 assert.deepEqual(response.allowedMentions,{parse:[]});
 assert.equal(commandGuide(g,'community').components[0].components.length,5);
});
test('channel lock restores the exact previous public message bit and refuses changed permissions',async()=>{
 const allow=new PermissionsBitField(P.SendMessages),deny=new PermissionsBitField(0n);
 const overwrite={allow,deny};const actor={id:a,permissions:new PermissionsBitField(P.ManageChannels)};
 const channel={id:'523456789012345678',type:ChannelType.GuildText,permissionOverwrites:{cache:new Map([[g,overwrite]]),edit:async(_id,p)=>{allow.remove(P.SendMessages);deny.remove(P.SendMessages);if(p.SendMessages===true)allow.add(P.SendMessages);if(p.SendMessages===false)deny.add(P.SendMessages);}},permissionsFor:()=>new PermissionsBitField(P.ManageChannels)};
 const guild={id:g,members:{fetch:async()=>actor,me:{permissions:new PermissionsBitField(P.ManageChannels)}}};
 const invocation=name=>({guild,guildId:g,channel,channelId:channel.id,commandName:name,user:{id:a},options:{},isButton:()=>false,isChatInputCommand:()=>true,deferReply:async()=>{},editReply:async()=>{}});
 await extraInteraction(invocation('lock'));
 assert.equal(getState(g,'chat_lock:'+channel.id).previous,'allow');assert.equal(deny.has(P.SendMessages),true);
 deny.remove(P.SendMessages);await extraInteraction(invocation('unlock'));assert.notEqual(getState(g,'chat_lock:'+channel.id),null);
 deny.add(P.SendMessages);await extraInteraction(invocation('unlock'));
 assert.equal(getState(g,'chat_lock:'+channel.id),null);assert.equal(allow.has(P.SendMessages),true);
});
test.after(()=>{db.close();fs.rmSync(process.env.DATA_DIR,{recursive:true,force:true});});
