import {securitySuiteDefaults,validateSecuritySuite} from './security-suite-config.js';
import {communityDefaults,validateCommunity} from './community-catalog.js';
import {logDefaults,validateLogs} from './log-catalog.js';
export const tiers=['basic','plus','ultimate'];
const n=(key,label,min,max,value)=>({key,label,type:'number',min,max,value});
const s=(key,label,value='')=>({key,label,type:'text',value});
const pick=(key,label,options,value)=>({key,label,type:'select',options,value});
const msg=[pick('action','Response',['log','delete','timeout'],'log'),n('timeoutMinutes','Timeout minutes',1,1440,10)];
const member=[pick('action','Response',['log','quarantine','kick'],'log')];
const audit=[n('limit','Actions before response',1,50,3),n('window','Window (seconds)',5,300,30),pick('action','Response',['log','strip'],'log')];
const module=(id,name,tier,description,fields=[],category='protection')=>({id,name,tier,description,fields,category});
export const modules=[
module('spam','Anti-Spam','basic','Detect bursts and repeated messages.',[n('limit','Messages',3,30,6),n('window','Window (seconds)',2,60,8),n('duplicates','Repeated messages',2,20,3),...msg]),
module('links','Anti-Link','basic','Control links with an exact-domain allowlist.',[s('allowedDomains','Allowed domains, one per line'),...msg]),
module('invites','Anti-Invite','basic','Detect Discord invite links.',msg),
module('mentions','Anti-Mass Mention','basic','Detect excessive user and role mentions, including everyone.',[n('limit','Mention limit',2,50,5),...msg]),
module('words','Bad Words Filter','basic','Match your word list with Unicode word boundaries.',[s('words','Blocked words, one per line'),...msg]),
module('automod','Basic AutoMod','basic','Limit excessive uppercase and long messages.',[n('caps','Uppercase percentage',50,100,80),n('length','Maximum message length',100,4000,1500),...msg]),
module('logs','Basic Security Logs','basic','Store security incidents and send them to your chosen channel.',[],'monitoring'),
module('joins','Join / Leave Monitoring','basic','Record member arrivals and departures.',[],'monitoring'),
module('raid','Anti-Raid','plus','Detect join bursts and apply the response to incoming members.',[n('limit','Joins',3,100,10),n('window','Window (seconds)',5,300,30),n('duration','Raid mode (minutes)',1,60,5),...member]),
module('verification','Verification','plus','Hold new members until a moderator approves /verify.',[n('minutes','Hold duration (minutes)',1,1440,60)]),
module('age','Account Age Gate','plus','Check how old an account is before it joins.',[n('days','Minimum account age (days)',1,365,7),...member]),
module('quarantine','New Member Quarantine','plus','Temporarily time out new human members for review.',[n('minutes','Quarantine minutes',1,1440,10)]),
module('bots','Anti-Bot','plus','Detect added bots; allow approved bot IDs through the trust list.',[pick('action','Response',['log','kick'],'log')]),
module('scam','Scam / Phishing Protection','plus','Match your blocked domains and common Discord impersonation domains. No reputation feed.',[s('blockedDomains','Blocked domains, one per line'),...msg]),
module('urls','Suspicious URL Detection','plus','Flag IP hosts, embedded credentials, punycode and selected shorteners. Heuristics can flag safe links.',msg),
module('voice','Voice Spam Protection','plus','Detect rapid voice-channel joins and switches.',[n('limit','Channel changes',3,30,6),n('window','Window (seconds)',5,120,15),pick('action','Response',['log','disconnect'],'log')]),
module('advancedLogs','Advanced Security Logs','plus','Record audit actor, target, action and result.',[],'monitoring'),
module('trust','Whitelist / Trusted Users','plus','Exclude explicitly trusted users and roles from automated protection.',[],'access'),
module('nuke','Anti-Nuke','ultimate','React to destructive audit bursts. Requires View Audit Log and a higher bot role.',audit),
module('massModeration','Anti-Mass Ban / Kick','ultimate','Detect repeated bans and kicks by the same actor.',audit),
module('channels','Channel Protection','ultimate','Detect channel deletion and edits.',audit),
module('roles','Role Protection','ultimate','Detect role deletion and edits.',audit),
module('permissions','Permission Guard','ultimate','Detect newly granted dangerous role permissions and assignments.',[pick('action','Response',['log','strip'],'log')]),
module('webhooks','Webhook Protection','ultimate','Detect webhook creation, editing and deletion.',audit),
module('protected','Protected Roles / Channels','ultimate','React to the first change of explicitly protected resources.',[pick('action','Response',['log','strip'],'log')]),
module('lockdown','Emergency Lockdown','ultimate','Freeze messaging for @everyone in selected channels; restore the previous overwrites.',[],'response'),
module('scanner','Security Scanner','ultimate','Check permissions, missing bot capabilities and protection configuration.',[],'insights'),
module('score','Security Score','ultimate','A transparent configuration checklist score, not a safety guarantee.',[],'insights'),
module('reports','Incident Reports','ultimate','Download the most recent 1,000 retained events as JSON.',[],'insights'),
module('timeline','Security Timeline','ultimate','Filter recorded events by actor, type and outcome.',[],'insights'),
module('backup','Backup & Restore','ultimate','Snapshot roles, channel structure and VEX settings. Restore missing roles/channels; messages and memberships are not restored.',[],'response'),
module('tamper','Tamper Alerts','ultimate','Alert when VEX settings, bot roles or native AutoMod rules change.',[],'monitoring'),
module('owner','Owner Alerts','ultimate','Send significant incidents to the server owner, with a cooldown.',[n('cooldown','Alert cooldown (seconds)',30,600,60)],'monitoring'),
module('risk','Advanced Risk Rules','ultimate','Escalate repeated incidents by one member within a time window.',[n('limit','Incidents',2,20,3),n('window','Window (seconds)',10,600,120),n('timeoutMinutes','Timeout minutes',1,1440,30)])
];
export const byId=Object.fromEntries(modules.map(m=>[m.id,m]));
export function entitled(plan,id){return !!byId[id]&&tiers.indexOf(plan)>=tiers.indexOf(byId[id].tier);}
export function defaults(){return {securitySuite:securitySuiteDefaults(),community:communityDefaults(),logsChannelId:'',activityLogs:logDefaults(),commandRules:{},exemptRoles:[],exemptChannels:[],trustedUsers:[],trustedRoles:[],protectedRoles:[],protectedChannels:[],lockdownChannels:[],modules:Object.fromEntries(modules.map(m=>[m.id,{enabled:['logs','joins'].includes(m.id),...Object.fromEntries(m.fields.map(f=>[f.key,f.value]))}]))};}
const ids=v=>Array.isArray(v)&&v.length<=100&&v.every(i=>typeof i==='string'&&/^\d{17,22}$/.test(i));
export function validatePatch(p,plan,owner=false){
 if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Invalid settings');
 const out={};
 for(const [k,v]of Object.entries(p)){
  if(k==='securitySuite'){out.securitySuite=validateSecuritySuite(v,owner);if(out.securitySuite.ai?.enabled===true&&plan!=='ultimate')throw Error('AI Security requires Ultimate access');}
  else if(k==='logsChannelId'){if(typeof v!=='string'||!/^\d{17,22}$|^$/.test(v))throw Error('Invalid log channel');out[k]=v;}
  else if(k==='community')out.community=validateCommunity(v);
  else if(k==='activityLogs')out.activityLogs=validateLogs(v);
  else if(k==='commandRules')out.commandRules=v;
  else if(['exemptRoles','exemptChannels','trustedUsers','trustedRoles','protectedRoles','protectedChannels','lockdownChannels'].includes(k)){
   if(!ids(v))throw Error('Invalid IDs');
   if(!owner&&k!=='exemptChannels')throw Error('Server owner required for trust and protected resources');
   if(k.startsWith('trusted')&&!entitled(plan,'trust'))throw Error('Plus required');
   if((k.startsWith('protected')||k==='lockdownChannels')&&!entitled(plan,'protected'))throw Error('Ultimate required');out[k]=[...new Set(v)];
  }else if(k==='modules'){
   if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid modules');out.modules={};
   for(const [id,values]of Object.entries(v)){
    if(!entitled(plan,id))throw Error('Plan does not include '+id);
    if(!values||typeof values!=='object'||Array.isArray(values))throw Error('Invalid module');const result={};
    for(const [key,value]of Object.entries(values)){
     if(key==='enabled'){if(typeof value!=='boolean')throw Error('Invalid toggle');result[key]=value;continue;}
     const f=byId[id].fields.find(x=>x.key===key);if(!f)throw Error('Unknown field');
     if(f.type==='number'&&(!Number.isInteger(value)||value<f.min||value>f.max))throw Error('Out of range: '+f.label);
     if(f.type==='select'&&!f.options.includes(value))throw Error('Invalid option');
     if(f.type==='text'&&(typeof value!=='string'||value.length>3000))throw Error('Text too long');result[key]=value;
    }out.modules[id]=result;
   }
  }else throw Error('Unknown setting: '+k);
 }return out;
}
