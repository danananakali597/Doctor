import {PermissionFlagsBits as P,Events} from 'discord.js';
import {settings,events} from './db.js';
import {logEvents,logById,validateLogs} from './log-catalog.js';
import {buildLogEmbed} from './log-design.js';
import {commandAccess} from './command-policy.js';
import {canEdit,saveVersion} from './workspace.js';
const owns=i=>i.isChatInputCommand?.()&&i.commandName==='logs';
export async function logCommand(i){
 await i.deferReply({ephemeral:true});
 if(!i.inGuild())return i.editReply('Use /logs inside your server.');
 const member=await i.guild.members.fetch({user:i.user.id,force:true});
 if(!member.permissions.has(P.ManageGuild)||!canEdit(i.guild,member,'logs'))return i.editReply('Manage Server and access to activity log settings are required.');
 const blocked=commandAccess(i.guildId,'logs',member,i.channel);if(blocked)return i.editReply(blocked);
 const action=i.options.getSubcommand(),config=settings(i.guildId).activityLogs;
 if(action==='configure'){
  const name=i.options.getString('event',true).trim().toLowerCase(),chosen=logEvents.filter(e=>e.id===name||e.group===name);
  if(!chosen.length)return i.editReply('Unknown event. Categories: members, messages, moderation, channels, roles, voice, server.');
  const channel=i.options.getChannel('channel',true),enabled=i.options.getBoolean('enabled',true);
  if(channel.guildId!==i.guildId||![0,5].includes(channel.type))return i.editReply('Choose a text channel in this server.');
  const botPerms=channel.permissionsFor(i.guild.members.me);
  if(enabled&&(!botPerms?.has([P.ViewChannel,P.SendMessages,P.EmbedLinks])))return i.editReply('VEX needs View Channel, Send Messages and Embed Links in that destination.');
  if(!channel.permissionsFor(member)?.has(P.ViewChannel))return i.editReply('Choose a channel you can view.');
  const patch=validateLogs(Object.fromEntries(chosen.map(e=>[e.id,{enabled,channelId:channel.id}])));
  saveVersion(i.guildId,{activityLogs:patch},member.id);
  return i.editReply(`${enabled?'Enabled':'Disabled'} ${chosen.length} log events → <#${channel.id}>.`);
 }
 if(action==='test'){
  const id=i.options.getString('event',true).trim().toLowerCase(),spec=logById[id],rule=config[id];
  if(!spec||!rule?.enabled)return i.editReply('Choose an enabled event. Use /logs status or /logs configure first.');
  const channel=i.guild.channels.cache.get(rule.channelId);
  if(!channel||![0,5].includes(channel.type)||!channel.permissionsFor(member)?.has(P.ViewChannel))return i.editReply('The destination is missing or you cannot view it.');
  if(!channel.permissionsFor(i.guild.members.me)?.has([P.ViewChannel,P.SendMessages,P.EmbedLinks]))return i.editReply('VEX cannot send embeds to that channel.');
  const embed=buildLogEmbed(i.guild,id,{actor:i.user.id,author:i.user.id,member:i.user.id,target:i.user.id,channel:channel.id,content:'Sample content — no message was deleted.',before_content:'Sample before',after_content:'Sample after',deleted_by:'Sample only — no deletion occurred',reason:'Demonstration only'}, {title:spec.name,group:spec.group});
  embed.title='🧪 SAMPLE • '+spec.name;embed.description='This is a preview. No real action occurred.';
  await channel.send({embeds:[embed],allowedMentions:{parse:[]}});return i.editReply(`Sample sent to <#${channel.id}>.`);
 }
 if(action==='recent'){
  const list=events(i.guildId,100).filter(e=>e.kind.startsWith('server_')).slice(0,10);
  return i.editReply({embeds:[{title:'Recent activity logs',description:list.map(e=>`• ${e.kind.slice(7).replaceAll('_',' ')} · <t:${Math.floor(e.at/1000)}:R>`).join('\n')||'No activity recorded.',color:0x8270f5}],allowedMentions:{parse:[]}});
 }
 const active=logEvents.filter(e=>config[e.id]?.enabled),groups=[...new Set(logEvents.map(e=>e.group))];
 return i.editReply({embeds:[{title:'VEX • Activity logs',description:`${active.length}/${logEvents.length} events enabled.\nConfigure by category or exact event name.`,fields:groups.map(group=>({name:group,value:logEvents.filter(e=>e.group===group).map(e=>`${config[e.id]?.enabled?'✅':'○'} ${e.id}${config[e.id]?.enabled?' → <#'+config[e.id].channelId+'>':''}`).join('\n').slice(0,1024),inline:false})),color:0x8270f5}],allowedMentions:{parse:[]}});
}
export function attachLogCommands(client){
 for(const listener of client.listeners(Events.InteractionCreate)){client.removeListener(Events.InteractionCreate,listener);client.on(Events.InteractionCreate,function(i){if(!owns(i))return listener.call(this,i);});}
 client.on(Events.InteractionCreate,i=>{if(owns(i))void logCommand(i).catch(async e=>{console.warn('Log command:',e.code||e.name);if(i.deferred)await i.editReply('The request could not be completed. Check the destination permissions and try again.').catch(()=>{});});});
}
