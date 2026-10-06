export const logPalette=Object.freeze({normal:'#3498db',warning:'#f39c12',danger:'#e74c3c'});
const warnings=new Set(['message_deleted','messages_bulk_deleted','member_kicked','members_pruned','timeout_given','channel_deleted','channel_permissions_changed','role_deleted','webhook_created','webhook_updated','webhook_deleted','automod_rule_deleted','message_violation','join_protection','voice_spam','security_configuration_changed']);
const dangers=new Set(['member_banned','security_incident','risk_escalation','bot_roles_changed','bot_removed','emergency_lockdown']);
export function logSeverity(id,details={},significant=false){
 if(dangers.has(id))return 'danger';
 const rules=String(details.rules||'').split(',').map(x=>x.trim());
 if(rules.some(x=>['raid','nuke','massModeration','permissions','protected','scam','urls'].includes(x)))return 'danger';
 return warnings.has(id)||significant?'warning':'normal';
}
const labels={content:'Message',attachments:'Attachments',actor:'Actor',author:'Author',member:'Member',target:'Target',channel:'Channel',before:'Before',after:'After',message:'Message ID',message_content:'Message',before_content:'Before',after_content:'After',deleted_by:'Deleted by',edited_by:'Edited by',deletion_audit_actor:'Matching deletion audit',audit_entry:'Audit entry',account_created:'Account created',accountDays:'Account age (days)'};
const titleCase=s=>s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const snowflake=value=>/^\d{17,22}$/.test(String(value));
function fieldValue(key,value,id){
 const text=String(value).slice(0,1000);
 if(snowflake(text)){
  if(['actor','author','member','deleted_by','edited_by','deletion_audit_actor'].includes(key))return `<@${text}>`;
  if(['channel','from','to','parent'].includes(key))return `<#${text}>`;
  if(key==='target'&&/^(member_|timeout_|verification_)/.test(id))return `<@${text}>`;
  if(key==='target'&&id.startsWith('role_'))return `<@&${text}>`;
  if(key==='target'&&/^(channel_|thread_)/.test(id))return `<#${text}>`;
 }
 return text||'—';
}
export function buildLogEmbed(guild,id,details={},options={}){
 const severity=logSeverity(id,details,options.significant);
 const icon=id==='message_deleted'?'🗑️':id==='message_edited'?'✏️':id==='member_banned'?'🛡️':severity==='danger'?'🚨':severity==='warning'?'⚠️':'ℹ️';
 const fields=[];
 const add=(key,name,value,inline=false)=>{
  if(value===null||value===undefined)return;
  if(['content','message_content','before_content','after_content'].includes(key)){
   const text=(String(value)||'No text available.').replaceAll('`','ˋ').slice(0,4000);
   for(let start=0;start<text.length;start+=970)fields.push({name:start?`${name} (continued)`:name,value:'```\n'+text.slice(start,start+970)+'\n```',inline:false});
  }else fields.push({name,value:fieldValue(key,value,id),inline});
 };
 if(id==='message_deleted'){
  add('author','Author',details.author??'Unavailable — message was not cached');
  add('channel','Channel',details.channel);
  add('deleted_by','Deleted by',details.deleted_by??'Unconfirmed — no matching Discord audit entry');
  add('content','Message',details.content??details.message_content??'Unavailable — message was not cached');
  add('attachments','Attachments',details.attachments);
 }else if(id==='message_edited'){
  add('member','Member',details.author??details.member,true);
  add('channel','Channel',details.channel,true);
  add('before_content','Before',details.before_content??details.before??'Unavailable — previous text was not cached');
  add('after_content','After',details.after_content??details.after??'No text available.');
 }else if(id==='member_banned'){
  add('member','Member',details.target??details.member,true);
  add('actor','Moderator',details.actor??'Unavailable',true);
  add('reason','Reason',details.reason||'No reason provided.');
 }else{
  for(const [key,value] of Object.entries(details).filter(([key,value])=>!['avatar_url','thumbnail_url'].includes(key)&&value!==null&&value!==undefined).slice(0,20)){
   add(key,labels[key]||titleCase(key),value,!['content','attachments','deleted_by','before','after','message_content','before_content','after_content','deletion_audit_actor','note','reason','changed','rules','result'].includes(key)&&String(value).length<80);
  }
 }
 let remaining=5000;
 const boundedFields=fields.flatMap(field=>{if(remaining<field.name.length+field.value.length)return [];remaining-=field.name.length+field.value.length;return [field];});
 const userId=id==='member_banned'?details.target??details.member:details.author||details.member||details.actor;
 const user=guild.members?.cache?.get(userId)?.user||guild.client?.users?.cache?.get(userId);
 const avatar=details.avatar_url||user?.displayAvatarURL?.({size:128});
 const group=id.startsWith('message_')||id==='messages_bulk_deleted'?'Message Logs':id==='member_banned'?'Moderation':`${titleCase(options.group||'security')} Logs`;
 return {title:`${icon} ${titleCase(options.title||id)}`,color:parseInt(logPalette[severity].slice(1),16),fields:boundedFields,timestamp:new Date().toISOString(),footer:{text:`VEX • ${group}${details.incident?` • Incident ${String(details.incident).slice(0,80)}`:''}`},...(avatar?{thumbnail:{url:avatar}}:{})};
}
