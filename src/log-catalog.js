import {logPalette,logSeverity} from './log-design.js';
const groups={"members": ["member_joined", "member_left", "nickname_changed", "member_roles_changed"], "messages": ["message_edited", "message_deleted", "messages_bulk_deleted", "pins_changed"], "moderation": ["member_banned", "member_unbanned", "member_kicked", "members_pruned", "timeout_given", "timeout_removed"], "channels": ["channel_created", "channel_updated", "channel_deleted", "channel_permissions_changed", "thread_created", "thread_updated", "thread_deleted"], "roles": ["role_created", "role_updated", "role_deleted"], "voice": ["voice_joined", "voice_left", "voice_moved", "voice_mute_changed", "voice_deaf_changed", "member_moved_by_moderator", "member_disconnected_by_moderator"], "server": ["server_updated", "invite_created", "invite_updated", "invite_deleted", "webhook_created", "webhook_updated", "webhook_deleted", "emoji_created", "emoji_updated", "emoji_deleted", "sticker_created", "sticker_updated", "sticker_deleted", "scheduled_event_created", "scheduled_event_updated", "scheduled_event_deleted", "automod_rule_created", "automod_rule_updated", "automod_rule_deleted"]};
export const logEvents=Object.entries(groups).flatMap(([group,ids])=>ids.map(id=>({id,group,name:id.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase()),severity:logSeverity(id),color:logPalette[logSeverity(id)]})));
export const logById=Object.fromEntries(logEvents.map(e=>[e.id,e]));
export const logDefaults=()=>Object.fromEntries(logEvents.map(e=>[e.id,{enabled:false,channelId:'',color:e.color}]));
export function mergeLogs(base,patch={}){return Object.fromEntries(logEvents.map(e=>[e.id,{...base[e.id],...patch[e.id],color:e.color}]));}
export function validateLogs(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid log settings');
 const out={};
 for(const [id,rule] of Object.entries(value)){
  if(!Object.hasOwn(logById,id)||!rule||typeof rule!=='object'||Array.isArray(rule))throw Error('Unknown log event');
  out[id]={};for(const [key,v] of Object.entries(rule)){
   if(key==='enabled'&&typeof v==='boolean')out[id][key]=v;
   else if(key==='channelId'&&typeof v==='string'&&/^(?:\d{17,22})?$/.test(v))out[id][key]=v;
   else if(key==='color'&&typeof v==='string'&&/^#[a-fA-F0-9]{6}$/.test(v))out[id][key]=v;
   else throw Error('Invalid log setting: '+key);
  }
 }return out;
}
