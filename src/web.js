import {scopes,canEdit,patchScopes,accessPolicy,validateAccess,history,revision,saveVersion,preferences,savePreferences} from './workspace.js';
import {communityModules} from './community-catalog.js';
import {checkCommunity,communitySummary,publishPanel,moderate,memberCard} from './community.js';
import {notificationStatus} from './notifications.js';
import {logEvents} from './log-catalog.js';
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PermissionFlagsBits as P} from 'discord.js';
import {env} from './config.js';
import {client} from './bot.js';
import {settings,saveSettings,plan,events,getState,setState,setSession,getSession,deleteSession,grant} from './db.js';
import {modules,validatePatch,entitled} from './catalog.js';
import {record,verifyMember} from './security.js';
import {scan,backup,restore,restoreConfiguration,lockdown} from './operations.js';
import {WindowCounter} from './rules.js';
import {commands} from './commands.js';
import {validateCommandRules} from './command-policy.js';
import {attachGiftRoutes} from './gift-routes.js';
export const app=express();app.disable('x-powered-by');app.set('trust proxy',1);app.use(express.json({limit:'128kb'}));
const attempts=new WindowCounter(),states=new Map(),secure=env.publicUrl.startsWith('https://'),nonce=()=>crypto.randomBytes(32).toString('hex');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function cookie(req,key){return req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith(key+'='))?.slice(key.length+1)||'';}
const setCookie=(name,value,maxAge)=>`${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure?'; Secure':''}`;
app.use((req,res,next)=>{res.set({'Content-Security-Policy':"default-src 'self'; img-src 'self' https:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});res.set('Cache-Control','no-store');next();});
function auth(req,res,next){req.session=getSession(hash(cookie(req,'sid')));if(!req.session)return res.status(401).json({error:'Please sign in again.'});next();}
function csrf(req,res,next){if(req.get('origin')!==env.publicUrl||req.get('x-csrf-token')!==req.session.csrf)return res.status(403).json({error:'Invalid request token'});if(attempts.hit(req.session.user.id+':write',60).length>40)return res.status(429).json({error:'Please wait before making more changes.'});next();}
const ownerId=()=>client.application?.owner?.ownerId||client.application?.owner?.id;
const adminPerm=permissions=>(BigInt(permissions)&(P.ManageGuild|P.Administrator))!==0n;
async function guildAuth(req,res,next){try{if(!/^\d{17,22}$/.test(req.params.id))throw Error('Invalid server');const g=client.guilds.cache.get(req.params.id);if(!g)throw Error('Bot is not in this server');const m=await g.members.fetch({user:req.session.user.id,force:true});if(!m.permissions.has(P.ManageGuild))throw Error('Manage Server permission required');req.guild=g;req.member=m;next();}catch(e){res.status(403).json({error:e.message});}}
function owner(req,res,next){if(req.member.id!==req.guild.ownerId)return res.status(403).json({error:'Server owner required'});next();}
async function discord(url,opts={}){const r=await fetch('https://discord.com/api/v10'+url,{...opts,signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Discord sign-in failed; please retry');return r.json();}
app.get('/auth/login',(req,res)=>{if(attempts.hit(req.ip+':login',60).length>10)return res.status(429).send('Please try again in a minute.');for(const[k,v]of states)if(v.until<Date.now())states.delete(k);const state=nonce(),binding=nonce();states.set(hash(state),{binding:hash(binding),until:Date.now()+300000});res.setHeader('Set-Cookie',setCookie('oauth',binding,300));res.redirect('https://discord.com/oauth2/authorize?'+new URLSearchParams({client_id:env.clientId,redirect_uri:env.redirectUri,response_type:'code',scope:'identify guilds',state}));});
app.get('/auth/callback',async(req,res)=>{const key=hash(String(req.query.state||'')),s=states.get(key);states.delete(key);if(!s||s.until<Date.now()||s.binding!==hash(cookie(req,'oauth'))||typeof req.query.code!=='string')return res.status(400).send('Login expired. Return to the homepage and sign in again.');try{const token=await discord('/oauth2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.clientId,client_secret:env.clientSecret,grant_type:'authorization_code',code:req.query.code,redirect_uri:env.redirectUri})});const headers={Authorization:`Bearer ${token.access_token}`};const[u,guilds]=await Promise.all([discord('/users/@me',{headers}),discord('/users/@me/guilds',{headers})]);const id=nonce();setSession(hash(id),{user:{id:u.id,username:u.username},guilds,csrf:nonce()},Date.now()+86400000);res.setHeader('Set-Cookie',[setCookie('sid',id,86400),setCookie('oauth','',0)]);res.redirect('/');}catch(e){console.error('OAuth error:',e.message);res.status(502).send('Discord login failed. Please retry from the homepage.');}});
app.post('/auth/logout',auth,csrf,(req,res)=>{deleteSession(hash(cookie(req,'sid')));res.setHeader('Set-Cookie',setCookie('sid','',0));res.json({ok:true});});
const invite=()=> 'https://discord.com/oauth2/authorize?'+new URLSearchParams({client_id:env.clientId,scope:'bot applications.commands',permissions:P.Administrator.toString()});
app.get('/api/public',(_req,res)=>res.json({invite:invite()}));
app.get('/api/me',auth,(req,res)=>res.json({user:req.session.user,csrf:req.session.csrf,invite:invite(),operator:req.session.user.id===ownerId(),guilds:req.session.guilds.filter(g=>g.owner||adminPerm(g.permissions)).map(g=>({id:g.id,name:g.name,icon:g.icon,installed:client.guilds.cache.has(g.id)}))}));
app.get('/api/guilds/:id',auth,guildAuth,(req,res)=>{const g=req.guild,p=plan(g.id),b=getState(g.id,'backup');res.json({guild:{id:g.id,name:g.name,memberCount:g.memberCount,owner:req.member.id===g.ownerId,icon:g.iconURL?.({size:128})||null,banner:g.bannerURL?.({size:1024})||null},preferences:preferences(g.id,req.member.id),permissions:scopes.filter(s=>canEdit(g,req.member,s)),history:history(g.id),accessPolicy:req.member.id===g.ownerId?accessPolicy(g.id):null,botPermissions:['ViewChannel','SendMessages','EmbedLinks','ManageMessages','ViewAuditLog','ManageRoles'].map(name=>({name,ok:!!g.members.me?.permissions.has(P[name])})),plan:p,modules,commands:commands.map(({name,description,default_member_permissions})=>({name,description,moderator:!!default_member_permissions})),logEvents,communityModules,communitySummary:communitySummary(g.id),notificationStatus:notificationStatus(g.id),settings:settings(g.id),channels:g.channels.cache.filter(c=>!c.isThread()).map(c=>({id:c.id,name:c.name,type:c.type})),roles:g.roles.cache.filter(r=>r.id!==g.id).map(r=>({id:r.id,name:r.name})),events:events(g.id),scan:entitled(p,'scanner')?scan(g):null,backup:b?{at:b.at,roles:b.roles.length,channels:b.channels.length}:null,locked:Object.keys(getState(g.id,'lockdown',{})),botReady:client.isReady(),persistent:!!process.env.RAILWAY_VOLUME_MOUNT_PATH});});
app.put('/api/guilds/:id/settings',auth,csrf,guildAuth,async(req,res)=>{
 if(!req.member.permissions.has(P.Administrator))return res.status(403).json({error:'Administrator required to change security settings'});
 if(patchScopes(req.body||{}).some(s=>!canEdit(req.guild,req.member,s)))return res.status(403).json({error:'Your dashboard access does not allow these changes'});
 const restoring=req.body?.restoreRevision;
 if(restoring){if(req.member.id!==req.guild.ownerId)return res.status(403).json({error:'Server owner required'});if(req.body.confirm!==req.guild.name)return res.status(400).json({error:'Type the server name to confirm'});const row=revision(req.guild.id,restoring);if(!row)return res.status(404).json({error:'Revision not found'});req.body=JSON.parse(row.previous);}
 const patch=validatePatch(req.body,plan(req.guild.id),req.member.id===req.guild.ownerId),g=req.guild;
 if('commandRules'in patch){patch.commandRules=validateCommandRules(patch.commandRules);for(const rule of Object.values(patch.commandRules)){
  if(rule.allowedRoles?.some(id=>!g.roles.cache.has(id)||id===g.id)||rule.blockedRoles?.some(id=>!g.roles.cache.has(id)||id===g.id))return res.status(400).json({error:'Choose roles from this server'});
  if(rule.allowedChannels?.some(id=>!g.channels.cache.has(id))||rule.blockedChannels?.some(id=>!g.channels.cache.has(id)))return res.status(400).json({error:'Choose channels from this server'});
 }}
 if(patch.community?.welcome&&['journeyEnabled','sayHiEnabled','chatChannelId','rulesChannelId'].some(k=>Object.hasOwn(patch.community.welcome,k))&&req.member.id!==g.ownerId)return res.status(403).json({error:'Only the server owner can configure the welcome journey.'});
 if(patch.community)checkCommunity(g,patch.community);
 if(patch.logsChannelId){const c=g.channels.cache.get(patch.logsChannelId);if(!c?.isTextBased()||c.isThread())return res.status(400).json({error:'Choose a text channel in this server'});}
 for(const [id,change] of Object.entries(patch.activityLogs||{})){
 const rule={...settings(g.id).activityLogs[id],...change};
 if(rule.enabled&&!rule.channelId)return res.status(400).json({error:'Choose a channel for each enabled log'});
 if(rule.channelId){const c=g.channels.cache.get(rule.channelId);if(!c||![0,5].includes(c.type))return res.status(400).json({error:'Choose a text channel for server logs'});if(rule.enabled&&!c.permissionsFor(g.members.me)?.has(['ViewChannel','SendMessages','EmbedLinks']))return res.status(400).json({error:'VEX needs View Channel, Send Messages and Embed Links in the log channel'});}
 }
 for(const k of ['exemptChannels','protectedChannels','lockdownChannels'])if(patch[k]?.some(id=>!g.channels.cache.has(id)))return res.status(400).json({error:'Unknown server channel'});
 for(const k of ['exemptRoles','trustedRoles','protectedRoles'])if(patch[k]?.some(id=>!g.roles.cache.has(id)||id===g.id))return res.status(400).json({error:'Unknown role or @everyone is not allowed'});
 const changed=Object.keys(patch.modules||{});const updated=saveVersion(g.id,patch,req.member.id);await record(g,'settings_updated',{actor:req.member.id,modules:[...changed,...Object.keys(patch.community||{}),...Object.keys(patch.commandRules||{})].join(', ')||'access / routing'},true);res.json({settings:updated,history:history(g.id)});
});
app.post('/api/guilds/:id/community/action',auth,csrf,guildAuth,async(req,res)=>{
 const g=req.guild,{action,kind}=req.body||{};let result;
 if(action==='publish'){if(!canEdit(g,req.member,'publishing'))throw Error('Publishing access required');if(!['selfroles','tickets','embeds'].includes(kind))throw Error('Invalid panel');result=await publishPanel(g,kind);}
 else if(action==='test-card'){if(!canEdit(g,req.member,'publishing'))throw Error('Publishing access required');if(!['welcome','goodbye'].includes(kind))throw Error('Invalid card');const cfg=settings(g.id).community[kind],channel=g.channels.cache.get(cfg.channelId);if(!channel||![0,5].includes(channel.type)||!channel.permissionsFor(g.members.me)?.has([P.ViewChannel,P.SendMessages,P.EmbedLinks]))throw Error('Choose an accessible text channel first');const msg=await channel.send(memberCard(g,cfg,req.member));result={url:msg.url};}
 else if(action==='moderation'){if(!canEdit(g,req.member,'moderation'))return res.status(403).json({error:'Moderation access required'});if(req.body.confirm!==g.name)throw Error('Type the server name to confirm');result=await moderate(g,req.member,{...req.body,action:req.body.operation});}
 else throw Error('Unknown action');
 await record(g,'control_panel_action',{actor:req.member.id,modules:kind||req.body.action,result:'Completed'},true);res.json({result});
});
app.post('/api/guilds/:id/action',auth,csrf,guildAuth,async(req,res)=>{
 const {action}=req.body||{},g=req.guild;let result;
 if(action==='scan'){if(!entitled(plan(g.id),'scanner'))return res.status(403).json({error:'Ultimate required'});result=scan(g);}
 else if(action==='verify'){if(!canEdit(g,req.member,'moderation'))return res.status(403).json({error:'Moderation access required'});if(!req.member.permissions.has(P.ModerateMembers))return res.status(403).json({error:'Moderate Members required'});if(!/^\d{17,22}$/.test(req.body.memberId))throw Error('Invalid member ID');await verifyMember(g,req.member,await g.members.fetch(req.body.memberId));result={message:'Member approved'};}
 else{if(req.member.id!==g.ownerId)return res.status(403).json({error:'Server owner required'});
 if(action==='backup')result=await backup(g,req.member.id);
 else if(action==='restore'){if(req.body.confirm!==g.name)throw Error('Type the server name to confirm');result=await restore(g,req.member.id);}
 else if(action==='restore-settings'){if(req.body.confirm!==g.name)throw Error('Type the server name to confirm');result=await restoreConfiguration(g,req.member.id);}
 else if(action==='lock'||action==='unlock'){if(req.body.confirm!==g.name)throw Error('Type the server name to confirm');result=await lockdown(g,action==='lock',req.member.id);}
 else throw Error('Unknown action');}res.json({result});
});
app.get('/api/guilds/:id/report',auth,guildAuth,(req,res)=>{if(!entitled(plan(req.guild.id),'reports'))return res.status(403).json({error:'Ultimate required'});res.attachment('vex-incident-report.json').json({guild:req.guild.id,generatedAt:new Date().toISOString(),events:events(req.guild.id,1000)});});
// Only the Discord application owner may issue manual trial entitlements. No paid checkout is represented as active.


app.put('/api/guilds/:id/preferences',auth,csrf,guildAuth,(req,res)=>res.json({preferences:savePreferences(req.guild.id,req.member.id,req.body)}));
app.put('/api/guilds/:id/dashboard-access',auth,csrf,guildAuth,owner,async(req,res)=>{const policy=validateAccess(req.body);for(const id of Object.keys(policy)){if(id===req.guild.ownerId)throw Error('Owner always retains full access');const m=await req.guild.members.fetch({user:id,force:true});if(!m.permissions.has(P.Administrator))throw Error('Choose an existing Discord administrator');}setState(req.guild.id,'dashboard_access',policy);await record(req.guild,'control_panel_action',{actor:req.member.id,modules:'dashboard access',result:'Updated'},true);res.json({ok:true});});
app.get('/health',(_req,res)=>res.status(client.isReady()?200:503).json({ok:client.isReady(),version:'3.4.0'}));
attachGiftRoutes(app,{auth,csrf,guildAuth});
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)),'../public')));
app.use((err,_req,res,_next)=>{console.error('Web error:',err.message);res.status(400).json({error:err.message||'Request failed'});});
export function startWeb(){return app.listen(env.port,()=>console.log('VEX dashboard: '+env.publicUrl));}
