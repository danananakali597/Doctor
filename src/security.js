import {inspectSecurityAI,automatedResponses} from './security-suite.js';
import {Events,AuditLogEvent as A,PermissionFlagsBits as P} from 'discord.js';
import {settings,plan,event,getState,setState} from './db.js';
import {entitled} from './catalog.js';
import {WindowCounter,messageReasons} from './rules.js';
import {buildLogEmbed} from './log-design.js';
const counts=new WindowCounter(),cooldowns=new WindowCounter();
/* VEX_SECURITY_UNIFIED_MODE */ export const active=(g,id,s=settings(g))=>{const c=entitled(plan(g),id)&&s.modules[id]?.enabled?s.modules[id]:null;if(!c)return null;if(s.securitySuite.mode==='paused'&&!['logs','joins','advancedLogs','owner','tamper','scanner','score'].includes(id))return null;return s.securitySuite.mode==='monitor'?{...c,action:'log'}:c;};
export function trusted(member,s){return member.id===member.guild.ownerId||member.id===member.client.user.id||!!active(member.guild.id,'trust',s)&&(s.trustedUsers.includes(member.id)||member.roles.cache.some(r=>s.trustedRoles.includes(r.id)));}
export async function record(g,kind,detail,significant=false){
 event(g.id,kind,detail);const s=settings(g.id);
 if((active(g.id,'logs',s)||active(g.id,'advancedLogs',s))&&s.logsChannelId){
  const c=g.channels.cache.get(s.logsChannelId);if(c?.isTextBased())await c.send({embeds:[buildLogEmbed(g,kind,detail,{significant})],allowedMentions:{parse:[]}}).catch(()=>{});
 }
 const owner=active(g.id,'owner',s);if(significant&&owner&&cooldowns.hit(g.id+':owner',owner.cooldown).length===1){const m=await g.fetchOwner().catch(()=>null);await m?.send({content:`VEX alert in ${g.name}: ${kind}. Open your dashboard to review.`,allowedMentions:{parse:[]}}).catch(()=>{});}
}
async function hold(member,minutes,reason){
 if(!member.moderatable)throw Error('Cannot timeout member: missing permissions or role hierarchy');
 const until=Date.now()+minutes*60000;
 // Never replace a longer moderator-imposed timeout.
 if((member.communicationDisabledUntilTimestamp||0)>=until)throw Error('Existing timeout is longer; left unchanged');
 const previous=member.communicationDisabledUntilTimestamp||null;
 await member.timeout(minutes*60000,'VEX: '+reason);
 setState(member.guild.id,'hold:'+member.id,{until,previous,reason});return 'quarantined';
}
export async function verifyMember(g,actor,target){
 const s=getState(g.id,'hold:'+target.id);if(!s||s.until<Date.now())throw Error('No active VEX quarantine');
 if(actor.id!==g.ownerId&&actor.roles.highest.comparePositionTo(target.roles.highest)<=0)throw Error('Your role must be above the target');
 if(!target.moderatable)throw Error('Cannot manage this member');
 if(Math.abs((target.communicationDisabledUntilTimestamp||0)-s.until)>5000)throw Error('Timeout was changed by a moderator; use Discord to review it');
 await target.timeout(s.previous&&s.previous>Date.now()?s.previous-Date.now():null,'VEX verification approved');setState(g.id,'hold:'+target.id,null);await record(g,'verification_approved',{actor:actor.id,target:target.id});
}
async function memberResponse(m,config,reason){if(config.action==='kick'){if(!m.kickable)throw Error('Cannot kick: role hierarchy or permissions');await m.kick('VEX '+reason);return 'kicked';}if(config.action==='quarantine')return hold(m,10,reason);return 'logged';}
const auditGroups={nuke:[A.ChannelCreate,A.ChannelDelete,A.ChannelUpdate,A.RoleCreate,A.RoleDelete,A.RoleUpdate,A.MemberRoleUpdate,A.MemberBanAdd,A.MemberKick,A.WebhookCreate,A.WebhookDelete,A.GuildUpdate,A.AutoModerationRuleDelete],massModeration:[A.MemberBanAdd,A.MemberKick],channels:[A.ChannelDelete,A.ChannelUpdate,A.ChannelOverwriteCreate,A.ChannelOverwriteUpdate,A.ChannelOverwriteDelete],roles:[A.RoleDelete,A.RoleUpdate],webhooks:[A.WebhookCreate,A.WebhookUpdate,A.WebhookDelete]};
export const dangerous=P.Administrator|P.ManageGuild|P.ManageRoles|P.ManageChannels|P.ManageWebhooks|P.BanMembers|P.KickMembers;
export function permissionEscalation(entry){return(entry.changes||[]).some(c=>c.key==='permissions'&&((BigInt(c.new||0)&~BigInt(c.old||0))&dangerous)!==0n);}
export function attachSecurity(client){
 const on=(name,fn)=>client.on(name,(...args)=>void Promise.resolve().then(()=>fn(...args)).catch(e=>console.error('Security handler:',name,e.message)));
 async function inspect(m,isEdit=false){
  if(m.partial)m=await m.fetch();if(!m.guild||m.author?.bot||(!m.content&&!m.attachments?.size))return;
  const s=settings(m.guildId),member=m.member||await m.guild.members.fetch(m.author.id);if(trusted(member,s)||s.exemptChannels.includes(m.channelId)||member.roles.cache.some(r=>s.exemptRoles.includes(r.id)))return;
  const enabled=id=>isEdit&&id==='spam'?null:active(m.guildId,id,s);
  const reasons=messageReasons({guildId:m.guildId,userId:m.author.id,content:m.content,mentions:m.mentions.users.size+m.mentions.roles.size,everyone:m.mentions.everyone},enabled,counts);
  if(!reasons.length){await inspectSecurityAI(m,s,record);return;}
  const strength={log:0,delete:1,timeout:2};const id=reasons.sort((a,b)=>strength[s.modules[b].action]-strength[s.modules[a].action])[0],config=enabled(id);
  if(cooldowns.hit(m.guildId+':msg:'+m.author.id,3).length>1)return;
  const outcomes=[];if(config.action==='delete'||config.action==='timeout'){try{await m.delete();outcomes.push('message deleted');}catch{outcomes.push('delete failed');}}
  if(config.action==='timeout'){try{if(!member.moderatable)throw Error();await member.timeout(config.timeoutMinutes*60000,'VEX '+reasons.join(', '));outcomes.push('timed out');}catch{outcomes.push('timeout failed');}}
  await record(m.guild,'message_violation',{actor:m.author.id,channel:m.channelId,rules:reasons.join(', '),result:outcomes.join('; ')||'logged'},true);
  const risk=active(m.guildId,'risk',s);if(automatedResponses(m.guildId)&&risk&&counts.hit(m.guildId+':risk:'+m.author.id,risk.window).length>=risk.limit){let result='permission denied';if(member.moderatable){await member.timeout(risk.timeoutMinutes*60000,'VEX repeated incidents');result='timed out';}await record(m.guild,'risk_escalation',{actor:m.author.id,result},true);}
 }
 on(Events.MessageCreate,m=>inspect(m));on(Events.MessageUpdate,(_before,after)=>inspect(after,true));
 on(Events.GuildMemberAdd,async m=>{
  const g=m.guild,s=settings(g.id);if(active(g.id,'joins',s))await record(g,'member_joined',{target:m.id,accountDays:Math.floor((Date.now()-m.user.createdTimestamp)/86400000)});
  if(trusted(m,s))return;
  const actions=[];const raid=active(g.id,'raid',s);
  if(raid){const a=counts.hit(g.id+':joins',raid.window);if(a.length>=raid.limit)setState(g.id,'raidUntil',Date.now()+raid.duration*60000);if(getState(g.id,'raidUntil',0)>Date.now())actions.push(['raid',raid]);}
  const age=active(g.id,'age',s);if(age&&Date.now()-m.user.createdTimestamp<age.days*86400000)actions.push(['age',age]);
  const bot=active(g.id,'bots',s);if(m.user.bot&&bot)actions.push(['bots',bot]);
  if(!m.user.bot){for(const id of ['verification','quarantine']){const c=active(g.id,id,s);if(c)actions.push([id,{...c,action:'quarantine'}]);}}
  if(!actions.length)return;if(!automatedResponses(g.id))for(const row of actions)row[1]={...row[1],action:'log'};const order={log:0,quarantine:1,kick:2};actions.sort((a,b)=>order[b[1].action]-order[a[1].action]);const[id,c]=actions[0];
  let result;try{result=c.action==='quarantine'?await hold(m,c.minutes||10,id):await memberResponse(m,c,id);}catch(e){result=e.message;}
  await record(g,'join_protection',{target:m.id,rules:actions.map(a=>a[0]).join(', '),result},true);
 });
 on(Events.GuildMemberRemove,async m=>{if(active(m.guild.id,'joins'))await record(m.guild,'member_left',{target:m.id});if(m.id===client.user.id)event(m.guild.id,'bot_removed',{target:m.id});});
 on(Events.VoiceStateUpdate,async(before,after)=>{
  if(before.channelId===after.channelId||!after.channelId)return;const c=active(after.guild.id,'voice');if(!c||trusted(after.member,settings(after.guild.id)))return;
  if(counts.hit(after.guild.id+':voice:'+after.id,c.window).length<c.limit)return;
  if(cooldowns.hit(after.guild.id+':voiceaction:'+after.id,10).length>1)return;
  let result='logged';if(c.action==='disconnect'){try{await after.disconnect('VEX voice spam');result='disconnected';}catch{result='disconnect failed';}}
  await record(after.guild,'voice_spam',{actor:after.id,result},true);
 });
 on(Events.GuildMemberUpdate,async(before,after)=>{if(after.id===client.user.id&&active(after.guild.id,'tamper')&&before.roles.cache.map(r=>r.id).sort().join()!==after.roles.cache.map(r=>r.id).sort().join())await record(after.guild,'bot_roles_changed',{target:after.id},true);});
 on(Events.GuildAuditLogEntryCreate,async(entry,g)=>{
  // Gateway audit entries provide the responsible actor. Never guess from an unrelated latest entry.
  if(!entry.executorId||entry.executorId===client.user.id||Date.now()-entry.createdTimestamp>15000)return;
  const s=settings(g.id),actor=await g.members.fetch(entry.executorId).catch(()=>null);
  if(active(g.id,'advancedLogs',s))await record(g,'audit_event',{actor:entry.executorId,target:entry.targetId,action:entry.action});
  if(active(g.id,'tamper',s)&&[A.AutoModerationRuleCreate,A.AutoModerationRuleUpdate,A.AutoModerationRuleDelete,A.BotAdd].includes(entry.action))await record(g,'security_configuration_changed',{actor:entry.executorId,target:entry.targetId,action:entry.action},true);
  if(!actor||trusted(actor,s))return;
  const matched=[];
  for(const[id,actions]of Object.entries(auditGroups)){const c=active(g.id,id,s);if(c&&actions.includes(entry.action)&&counts.hit(g.id+':'+id+':'+actor.id,c.window).length>=c.limit)matched.push([id,c]);}
  const guard=active(g.id,'permissions',s);const addedRoles=entry.action===A.MemberRoleUpdate?(entry.changes.find(c=>c.key==='$add')?.new||[]):[];const dangerousAdds=addedRoles.filter(r=>{const role=g.roles.cache.get(r.id);return role&&(role.permissions.bitfield&dangerous)!==0n;});if(guard&&((entry.action===A.RoleUpdate&&permissionEscalation(entry))||dangerousAdds.length))matched.push(['permissions',guard]);
  const protectedRule=active(g.id,'protected',s);if(protectedRule&&[...s.protectedRoles,...s.protectedChannels].includes(entry.targetId)&&[...auditGroups.roles,...auditGroups.channels].includes(entry.action))matched.push(['protected',protectedRule]);
  if(!matched.length||cooldowns.hit(g.id+':auditaction:'+actor.id,5).length>1)return;
  let result='logged';if(matched.some(([,c])=>c.action==='strip')){
   const roles=actor.roles.cache.filter(r=>r.id!==g.id&&!r.managed&&(r.permissions.bitfield&dangerous)!==0n);
   const removable=roles.filter(r=>r.editable);if(!removable.size)result='no manageable dangerous roles; check hierarchy';else{try{await actor.roles.remove([...removable.keys()],'VEX destructive activity');result=`removed ${removable.size} dangerous roles; ${roles.size-removable.size} roles could not be removed`;}catch{result='role removal failed';}}
  }
  if(guard?.action==='strip'&&matched.some(([id])=>id==='permissions')){try{if(entry.action===A.RoleUpdate){const role=g.roles.cache.get(entry.targetId),change=entry.changes.find(c=>c.key==='permissions');if(role?.editable&&change){const added=(BigInt(change.new||0)&~BigInt(change.old||0))&dangerous;await role.setPermissions(role.permissions.bitfield&~added,'VEX permission guard');result+='; dangerous permission additions reverted';}}else if(dangerousAdds.length){const target=await g.members.fetch(entry.targetId);await target.roles.remove(dangerousAdds.filter(r=>g.roles.cache.get(r.id)?.editable).map(r=>r.id),'VEX permission guard');result+='; added dangerous roles removed';}}catch{result+='; permission rollback failed';}}
  await record(g,'security_incident',{actor:actor.id,target:entry.targetId,action:entry.action,rules:matched.map(([id])=>id).join(', '),result},true);
 });
}
