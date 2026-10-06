import {PermissionFlagsBits as P,ChannelType} from 'discord.js';
import {settings,saveSettings,plan,getState,setState} from './db.js';
import {entitled} from './catalog.js';
import {record,active,dangerous} from './security.js';
const locks=new Set();
export async function exclusive(g,fn){if(locks.has(g.id))throw Error('Another security operation is running');locks.add(g.id);try{return await fn();}finally{locks.delete(g.id);}}
export function scan(g){const s=settings(g.id),me=g.members.me;
 const checks=[{name:'View audit log',ok:!!me?.permissions.has(P.ViewAuditLog)},{name:'Manage roles',ok:!!me?.permissions.has(P.ManageRoles)},{name:'Manage channels',ok:!!me?.permissions.has(P.ManageChannels)},{name:'Manage messages',ok:!!me?.permissions.has(P.ManageMessages)},{name:'Timeout members',ok:!!me?.permissions.has(P.ModerateMembers)},{name:'Log channel configured',ok:!!g.channels.cache.get(s.logsChannelId)?.isTextBased()},{name:'Anti-spam enabled',ok:!!active(g.id,'spam',s)},{name:'Mass mention protection enabled',ok:!!active(g.id,'mentions',s)},{name:'@everyone has no administrative permissions',ok:(g.roles.everyone.permissions.bitfield&dangerous)===0n},{name:'Bot role above all non-managed administrative roles',ok:!!me&&g.roles.cache.filter(r=>r.id!==g.id&&!r.managed&&(r.permissions.bitfield&dangerous)!==0n).every(r=>me.roles.highest.comparePositionTo(r)>0)}];
 return {score:Math.round(checks.filter(c=>c.ok).length/checks.length*100),checks,notice:'Configuration checklist only. This score does not guarantee protection.'};
}
const bits=P.SendMessages|P.SendMessagesInThreads|P.CreatePublicThreads|P.CreatePrivateThreads|P.AddReactions;
export async function lockdown(g,enabled,actor){
 if(enabled&&!entitled(plan(g.id),'lockdown'))throw Error('Ultimate required');
 return exclusive(g,async()=>{
  let saved=getState(g.id,'lockdown',{});const results=[];
  if(enabled){const targets=settings(g.id).lockdownChannels;if(!targets.length)throw Error('Choose lockdown channels first');
   for(const id of targets){if(saved[id])continue;const c=g.channels.cache.get(id);if(!c?.permissionOverwrites){results.push({id,error:'Unsupported channel'});continue;}const old=c.permissionOverwrites.cache.get(g.id);const item={allow:old?.allow.bitfield.toString()||'0',deny:old?.deny.bitfield.toString()||'0',existed:!!old};
    // Save before mutation so a restart cannot lose the restoration data.
    saved[id]=item;setState(g.id,'lockdown',saved);
    try{await c.permissionOverwrites.edit(g.id,{SendMessages:false,SendMessagesInThreads:false,CreatePublicThreads:false,CreatePrivateThreads:false,AddReactions:false},{reason:'VEX emergency lockdown'});results.push({id,result:'locked'});}catch(e){results.push({id,error:e.message+'; restore record retained for recovery'});}
   }
  }else for(const[id,old]of Object.entries(saved)){
   const c=g.channels.cache.get(id);if(!c){delete saved[id];continue;}
   try{const current=c.permissionOverwrites.cache.get(g.id);const allow=((current?.allow.bitfield||0n)&~bits)|(BigInt(old.allow)&bits),deny=((current?.deny.bitfield||0n)&~bits)|(BigInt(old.deny)&bits);
    if(!old.existed&&allow===0n&&deny===0n)await c.permissionOverwrites.delete(g.id,'VEX unlock');else await c.permissionOverwrites.create(g.id,Object.fromEntries(Object.entries(P).filter(([,v])=>(v&bits)!==0n).map(([k,v])=>[k,(allow&v)!==0n?true:(deny&v)!==0n?false:null])),{reason:'VEX restore lockdown permissions'});
    delete saved[id];results.push({id,result:'unlocked'});
   }catch(e){results.push({id,error:e.message});}setState(g.id,'lockdown',saved);
  }
  setState(g.id,'lockdown',saved);await record(g,enabled?'lockdown_enabled':'lockdown_restored',{actor,results:JSON.stringify(results)},true);return results;
 });
}
export async function backup(g,actor){if(!entitled(plan(g.id),'backup'))throw Error('Ultimate required');return exclusive(g,async()=>{
 await g.roles.fetch();await g.channels.fetch();
 const snapshot={guild:g.id,at:Date.now(),settings:settings(g.id),roles:g.roles.cache.filter(r=>!r.managed&&r.id!==g.id).map(r=>({id:r.id,name:r.name,color:r.color,hoist:r.hoist,mentionable:r.mentionable,permissions:r.permissions.bitfield.toString(),position:r.position})),channels:g.channels.cache.filter(c=>[ChannelType.GuildCategory,ChannelType.GuildText,ChannelType.GuildVoice,ChannelType.GuildAnnouncement].includes(c.type)).map(c=>({id:c.id,name:c.name,type:c.type,parent:c.parentId,position:c.rawPosition,topic:c.topic||null,nsfw:!!c.nsfw,rateLimitPerUser:c.rateLimitPerUser||0,permissionOverwrites:c.permissionOverwrites.cache.map(o=>({id:o.id,type:o.type,allow:o.allow.bitfield.toString(),deny:o.deny.bitfield.toString()}))}))};
 setState(g.id,'backup',snapshot);setState(g.id,'restoreMap',{});await record(g,'backup_created',{actor,roles:snapshot.roles.length,channels:snapshot.channels.length});return {at:snapshot.at,roles:snapshot.roles.length,channels:snapshot.channels.length};
 });}
export async function restore(g,actor){if(!entitled(plan(g.id),'backup'))throw Error('Ultimate required');return exclusive(g,async()=>{
 const snap=getState(g.id,'backup');if(!snap||snap.guild!==g.id)throw Error('No backup for this server');
 await g.roles.fetch();await g.channels.fetch();const map=getState(g.id,'restoreMap',{}),results=[];
 for(const r of snap.roles.sort((a,b)=>a.position-b.position)){
  if(g.roles.cache.has(r.id)){map[r.id]=r.id;continue;}if(map[r.id]&&g.roles.cache.has(map[r.id]))continue;
  try{const created=await g.roles.create({name:r.name,color:r.color,hoist:r.hoist,mentionable:r.mentionable,permissions:BigInt(r.permissions),reason:'VEX backup restore'});map[r.id]=created.id;setState(g.id,'restoreMap',map);results.push('Role restored: '+r.name);}catch(e){results.push('Role failed: '+r.name+' — '+e.message);}
 }
 for(const c of snap.channels.sort((a,b)=>(a.type===4?0:1)-(b.type===4?0:1)||a.position-b.position)){
  if(g.channels.cache.has(c.id)){map[c.id]=c.id;continue;}if(map[c.id]&&g.channels.cache.has(map[c.id]))continue;
  try{
   // Abort instead of accidentally creating a public channel when a required role could not be restored.
   const overwrites=c.permissionOverwrites.map(o=>{const id=o.id===g.id?g.id:map[o.id]||o.id;if(o.type===0&&!g.roles.cache.has(id))throw Error('Required overwrite role missing');return {...o,id,allow:BigInt(o.allow),deny:BigInt(o.deny)};});
   const parent=c.parent?(map[c.parent]||c.parent):null;if(parent&&!g.channels.cache.has(parent))throw Error('Parent category missing');
   const created=await g.channels.create({name:c.name,type:c.type,parent,position:c.position,topic:c.topic,nsfw:c.nsfw,rateLimitPerUser:c.rateLimitPerUser,permissionOverwrites:overwrites,reason:'VEX backup restore'});map[c.id]=created.id;setState(g.id,'restoreMap',map);results.push('Channel restored: '+c.name);
  }catch(e){results.push('Channel failed: '+c.name+' — '+e.message);}
 }
 await record(g,'backup_restored',{actor,results:results.join('; ')},true);return {results,notice:'Only missing structure restored. Existing resources, messages, member roles and settings were not overwritten.'};
 });}
export async function restoreConfiguration(g,actor){
 if(!entitled(plan(g.id),'backup'))throw Error('Ultimate required');
 return exclusive(g,async()=>{const snap=getState(g.id,'backup');if(!snap||snap.guild!==g.id)throw Error('No backup for this server');const map=getState(g.id,'restoreMap',{}),s=structuredClone(snap.settings);
 for(const rule of Object.values(s.activityLogs||{})){if(!rule||typeof rule!=='object')continue;const id=map[rule.channelId]||rule.channelId;rule.channelId=g.channels.cache.has(id)?id:'';if(!rule.channelId)rule.enabled=false;}
 for(const key of ['logsChannelId']){const id=map[s[key]]||s[key];s[key]=g.channels.cache.has(id)?id:'';}
 for(const key of ['exemptChannels','protectedChannels','lockdownChannels'])s[key]=(s[key]||[]).map(id=>map[id]||id).filter(id=>g.channels.cache.has(id));
 for(const key of ['exemptRoles','protectedRoles','trustedRoles'])s[key]=(s[key]||[]).map(id=>map[id]||id).filter(id=>g.roles.cache.has(id));
 for(const cfg of Object.values(s.community||{}))if('enabled' in cfg)cfg.enabled=false;
 saveSettings(g.id,s);await record(g,'configuration_restored',{actor},true);return {message:'Archived settings restored. Missing resource references were removed; mapped resources were updated. Community modules are disabled pending review of their channel and role settings.'};
 });
}
