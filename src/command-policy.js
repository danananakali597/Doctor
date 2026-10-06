import {commands} from './commands.js';
import {settings} from './db.js';

export const commandNames=new Set(commands.map(command=>command.name));
export const commandDefaults=()=>({enabled:true,allowedRoles:[],blockedRoles:[],allowedChannels:[],blockedChannels:[]});
const id=value=>typeof value==='string'&&/^\d{17,22}$/.test(value);
export function validateCommandRules(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid command rules');
 const out={};
 for(const [name,patch] of Object.entries(input)){
  if(!commandNames.has(name))throw Error('Unknown command: '+name);
  if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Invalid command rule');
  const next={};
  for(const [key,value] of Object.entries(patch)){
   if(key==='enabled'){
    if(typeof value!=='boolean')throw Error('Invalid command toggle');
    if(['help','commands','vex'].includes(name)&&!value)throw Error('Keep help and commands available');
   }else if(['allowedRoles','blockedRoles','allowedChannels','blockedChannels'].includes(key)){
    if(!Array.isArray(value)||value.length>25||!value.every(id))throw Error('Invalid command access IDs');
    next[key]=[...new Set(value)];continue;
   }else throw Error('Unknown command rule field');
   next[key]=value;
  }
  out[name]=next;
 }
 return out;
}
export function commandAccess(guildId,name,member,channel){
 const rule={...commandDefaults(),...settings(guildId).commandRules?.[name]};
 if(!rule.enabled)return 'This command is disabled in the dashboard.';
 const roleIds=member.roles?.cache?.map(r=>r.id)||[];
 if(rule.blockedRoles.some(id=>roleIds.includes(id)))return 'Your role cannot use this command here.';
 if(rule.allowedRoles.length&&!rule.allowedRoles.some(id=>roleIds.includes(id)))return 'This command is limited to selected roles.';
 if(rule.blockedChannels.includes(channel?.id)||channel?.parentId&&rule.blockedChannels.includes(channel.parentId))return 'This command is disabled in this channel.';
 if(rule.allowedChannels.length&&!rule.allowedChannels.includes(channel?.id)&&!(channel?.parentId&&rule.allowedChannels.includes(channel.parentId)))return 'Use this command in a permitted channel.';
 return null;
}
