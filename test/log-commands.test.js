import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Collection,PermissionFlagsBits as P} from 'discord.js';
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'vex-logcmd-'));
const {logCommand}=await import('../src/log-commands.js');
const {settings,saveSettings,setState}=await import('../src/db.js');
let access=P.ManageGuild|P.Administrator,fetchOptions,reply,sent=0;
const member={id:'admin',permissions:{has:p=>(access&p)===p},roles:{cache:new Collection()}},channel={id:'123456789012345678',guildId:'223456789012345678',type:0,permissionsFor:()=>({has:()=>true}),send:async()=>{sent++;}};
const guild={id:channel.guildId,ownerId:'owner',members:{me:{},fetch:async args=>{fetchOptions=args;return member;}},channels:{cache:new Collection([[channel.id,channel]])}};
const i=(action,event='messages')=>({user:{id:'admin'},guild,guildId:guild.id,channel,options:{getSubcommand:()=>action,getString:()=>event,getChannel:()=>channel,getBoolean:()=>true},inGuild:()=>true,deferReply:async()=>{},editReply:async p=>{reply=p;}});
test('logs configuration checks fresh permissions and delegated log scope',async()=>{
 access=P.ManageGuild;await logCommand(i('configure'));assert.match(reply,/required/);assert.equal(settings(guild.id).activityLogs.message_deleted.enabled,false);
 access=P.ManageGuild|P.Administrator;setState(guild.id,'dashboard_access',{admin:['community']});await logCommand(i('configure'));assert.match(reply,/required/);
 setState(guild.id,'dashboard_access',{admin:['logs']});await logCommand(i('configure'));assert.match(reply,/Enabled 4/);assert.equal(fetchOptions.force,true);assert.equal(settings(guild.id).activityLogs.message_deleted.channelId,channel.id);assert.equal(settings('other').activityLogs.message_deleted.enabled,false);
});
test('disabled command policy blocks Discord log configuration',async()=>{
 saveSettings(guild.id,{commandRules:{logs:{enabled:false}}});await logCommand(i('configure','roles'));assert.match(reply,/disabled/);assert.equal(settings(guild.id).activityLogs.role_created.enabled,false);saveSettings(guild.id,{commandRules:{logs:{enabled:true}}});
});
test('invalid event and foreign channel cannot change log routing',async()=>{
 await logCommand(i('configure','fake'));assert.match(reply,/Unknown event/);
 const request=i('configure','roles');request.options.getChannel=()=>({...channel,guildId:'other'});await logCommand(request);assert.match(reply,/this server/);assert.equal(settings(guild.id).activityLogs.role_created.enabled,false);
});
test('log preview sends only for enabled events and does not forge a real event',async()=>{
 await logCommand(i('test','role_created'));assert.match(reply,/enabled event/);assert.equal(sent,0);
 await logCommand(i('test','message_deleted'));assert.equal(sent,1);assert.match(reply,/Sample sent/);
});
