import {Events,AuditLogEvent as A,PermissionFlagsBits as P} from 'discord.js';
import {settings,event} from './db.js';
import {logById} from './log-catalog.js';
import {buildLogEmbed} from './log-design.js';
import {MessageLogCache} from './message-log-cache.js';
import {createMessageLogContext} from './message-log-context.js';
const auditNames={GuildUpdate:'server_updated',MemberKick:'member_kicked',MemberPrune:'members_pruned',MemberBanAdd:'member_banned',MemberBanRemove:'member_unbanned',MemberMove:'member_moved_by_moderator',MemberDisconnect:'member_disconnected_by_moderator',ChannelOverwriteCreate:'channel_permissions_changed',ChannelOverwriteUpdate:'channel_permissions_changed',ChannelOverwriteDelete:'channel_permissions_changed'};
for(const [prefix,label] of [['Invite','invite'],['Webhook','webhook'],['Emoji','emoji'],['Sticker','sticker'],['GuildScheduledEvent','scheduled_event'],['AutoModerationRule','automod_rule']])for(const [suffix,verb]of [['Create','created'],['Update','updated'],['Delete','deleted']])auditNames[prefix+suffix]=label+'_'+verb;
export const auditTypes=new Map(Object.entries(auditNames).filter(([key])=>typeof A[key]==='number').map(([key,value])=>[A[key],value]));
const gatewayAuditTypes={nickname_changed:A.MemberUpdate,member_roles_changed:A.MemberRoleUpdate,timeout_given:A.MemberUpdate,timeout_removed:A.MemberUpdate,channel_created:A.ChannelCreate,channel_updated:A.ChannelUpdate,channel_deleted:A.ChannelDelete,thread_created:A.ThreadCreate,thread_updated:A.ThreadUpdate,thread_deleted:A.ThreadDelete,role_created:A.RoleCreate,role_updated:A.RoleUpdate,role_deleted:A.RoleDelete};
export async function matchingAuditActor(guild,id,details,now=Date.now()){
 const type=gatewayAuditTypes[id],target=details.target||details.member;if(type===undefined||!target||!guild.members?.me?.permissions.has(P.ViewAuditLog))return {};
 try{const audit=await guild.fetchAuditLogs({type,limit:6});const key=id==='nickname_changed'?'nick':id.startsWith('timeout_')?'communication_disabled_until':null;const matches=[...audit.entries.values()].filter(e=>e.targetId===target&&Math.abs(now-e.createdTimestamp)<10000&&(!key||e.changes?.some(c=>c.key===key)));if(matches.length!==1||!matches[0].executorId)return {};return {actor:matches[0].executorId,audit_entry:matches[0].id,reason:matches[0].reason};}catch{return {};}
}
export function logSetting(guildId,id){const rule=settings(guildId).activityLogs[id];return rule?.enabled?rule:null;}
export async function serverLog(guild,id,details={}){
 const config=logSetting(guild.id,id),spec=logById[id];if(!config||!spec)return;
 if(!details.actor&&gatewayAuditTypes[id]!==undefined)details={...details,...await matchingAuditActor(guild,id,details)};
 const safe=Object.fromEntries(Object.entries(details).filter(([,v])=>v!==null&&v!==undefined).slice(0,20).map(([k,v])=>[k,String(v).slice(0,k==='content'?4000:['message_content','before_content','after_content'].includes(k)?1000:500)]));
 const actorId=[safe.actor,safe.deleted_by,safe.edited_by,safe.author,safe.member].find(v=>/^\d{17,22}$/.test(v||''));
 if(/^\d{17,22}$/.test(actorId||'')){const user=guild.client?.users?.cache?.get(actorId)||await guild.client?.users?.fetch(actorId).catch(()=>null);if(user){safe.actor_name=user.globalName||user.username;safe.actor_avatar_url=user.displayAvatarURL({size:64});}}
 const metadata=Object.fromEntries(Object.entries(safe).filter(([key])=>!['content','attachments','avatar_url','actor_avatar_url','actor_name','member_name','message_content','before_content','after_content'].includes(key)));
 event(guild.id,'server_'+id,{category:spec.group,...metadata});
 const channel=guild.channels.cache.get(config.channelId);if(!channel||![0,5].includes(channel.type))return;
 try{await channel.send({embeds:[buildLogEmbed(guild,id,safe,{title:spec.name,group:spec.group})],allowedMentions:{parse:[]}});}
 catch(e){console.warn('Server log delivery failed:',id,e.code||'unknown');}
}
export function attachServerLogs(client,{messageLogWaitMs=1500}={}){
 const messageContext=createMessageLogContext({waitMs:messageLogWaitMs});
 const on=(name,fn)=>client.on(name,(...args)=>void Promise.resolve().then(()=>fn(...args)).catch(e=>console.error('Server log handler:',name,e.code||e.name)));
 const send=(guild,id,details)=>guild?serverLog(guild,id,details):undefined;
 on(Events.GuildMemberAdd,m=>send(m.guild,'member_joined',{member:m.id,member_name:m.user.globalName||m.user.username,avatar_url:m.user.displayAvatarURL({size:128}),account_created:new Date(m.user.createdTimestamp).toISOString()}));
 on(Events.GuildMemberRemove,m=>send(m.guild,'member_left',{member:m.id,member_name:m.user.globalName||m.user.username,avatar_url:m.user.displayAvatarURL({size:128})}));
 on(Events.GuildMemberUpdate,async(before,after)=>{
  if(before.nickname!==after.nickname)await send(after.guild,'nickname_changed',{member:after.id,before:before.nickname||before.user.username,after:after.nickname||after.user.username});
  const added=after.roles.cache.filter(r=>!before.roles.cache.has(r.id)).map(r=>r.id),removed=before.roles.cache.filter(r=>!after.roles.cache.has(r.id)).map(r=>r.id);
  if(added.length||removed.length)await send(after.guild,'member_roles_changed',{member:after.id,added:added.join(', ')||'—',removed:removed.join(', ')||'—'});
  const old=before.communicationDisabledUntilTimestamp||0,next=after.communicationDisabledUntilTimestamp||0;
  if(old!==next)await send(after.guild,next>Date.now()?'timeout_given':'timeout_removed',{member:after.id,until:next?new Date(next).toISOString():'—'});
 });
 const snapshots=new MessageLogCache();
 const enabledMessages=g=>g&&(logSetting(g.id,'message_deleted')||logSetting(g.id,'message_edited'));
 on(Events.MessageCreate,m=>{if(enabledMessages(m.guild)){snapshots.remember(m);messageContext.remember(m);}});
 on(Events.MessageUpdate,async(before,after)=>{
  if(!enabledMessages(after.guild)||after.author?.bot)return;
  const cached=snapshots.get(after),old=before.partial?cached:snapshots.remember(before)||cached;
  if(after.partial&&after.fetch){try{after=await after.fetch();}catch{return;}}
  if(after.author?.bot)return;
  const next=snapshots.remember(after);messageContext.remember(after);
  if(old?.content===next?.content)return;
  return send(after.guild,'message_edited',{author:next?.author||old?.author||'Unknown — message was not cached',channel:after.channelId,edited_by:next?.author||old?.author||'Unknown',before_content:old?.content??'Unavailable — the previous text was not cached.',after_content:next?.content||'No text available.',message:after.id,avatar_url:next?.avatar_url||old?.avatar_url});
 });
 on(Events.MessageDelete,async m=>{
  if(!m.guild||!logSetting(m.guild.id,'message_deleted')||m.author?.bot)return;
  try{const details=await messageContext.deleted(m);return await send(m.guild,'message_deleted',details);}finally{snapshots.remove(m);}
 });
 on(Events.MessageBulkDelete,(messages,channel)=>send(channel.guild,'messages_bulk_deleted',{channel:channel.id,count:messages.size}));
 on(Events.ChannelPinsUpdate,(channel,time)=>send(channel.guild,'pins_changed',{channel:channel.id,last_pin:time?.toISOString()}));
 for(const [name,id]of [[Events.ChannelCreate,'channel_created'],[Events.ChannelDelete,'channel_deleted'],[Events.ThreadDelete,'thread_deleted'],[Events.GuildRoleCreate,'role_created'],[Events.GuildRoleDelete,'role_deleted']])on(name,item=>send(item.guild,id,{target:item.id,name:item.name}));
 on(Events.ThreadCreate,(thread,newlyCreated)=>newlyCreated?send(thread.guild,'thread_created',{target:thread.id,name:thread.name,parent:thread.parentId}):undefined);
 for(const [name,id]of [[Events.ChannelUpdate,'channel_updated'],[Events.ThreadUpdate,'thread_updated'],[Events.GuildRoleUpdate,'role_updated']])on(name,(before,after)=>{
  const keys=['name','type','topic','parentId','rateLimitPerUser','nsfw','archived','locked','autoArchiveDuration','color','hoist','mentionable'];
  const changes=keys.filter(k=>before[k]!==after[k]).map(k=>k);
  if(before.permissions?.bitfield!==after.permissions?.bitfield)changes.push('permissions');
  if(!changes.length)return;return send(after.guild,id,{target:after.id,name:after.name,changed:changes.join(', '),before:changes.map(k=>k+': '+String(before[k]?.bitfield??before[k]??'—')).join('\n'),after:changes.map(k=>k+': '+String(after[k]?.bitfield??after[k]??'—')).join('\n')});
 });
 on(Events.VoiceStateUpdate,async(before,after)=>{
  if(before.channelId!==after.channelId)await send(after.guild,!before.channelId?'voice_joined':!after.channelId?'voice_left':'voice_moved',{member:after.id,from:before.channelId,to:after.channelId});
  if(before.selfMute!==after.selfMute||before.serverMute!==after.serverMute)await send(after.guild,'voice_mute_changed',{member:after.id,self_muted:after.selfMute,server_muted:after.serverMute});
  if(before.selfDeaf!==after.selfDeaf||before.serverDeaf!==after.serverDeaf)await send(after.guild,'voice_deaf_changed',{member:after.id,self_deafened:after.selfDeaf,server_deafened:after.serverDeaf});
 });
 on(Events.GuildAuditLogEntryCreate,(entry,guild)=>{
  if(entry.action===A.MessageDelete){messageContext.audit(entry,guild);return;}
  if(Date.now()-entry.createdTimestamp>30000)return;
  const id=auditTypes.get(entry.action);if(!id)return;
  return send(guild,id,{actor:entry.executorId,target:entry.targetId,avatar_url:id==='member_banned'?entry.target?.displayAvatarURL?.({size:128}):undefined,audit_entry:entry.id,reason:entry.reason,count:entry.extra?.count,channel:entry.extra?.channel?.id,changed:entry.changes?.map(c=>c.key).join(', ')});
 });
}
