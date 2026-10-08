import {Routes,PermissionFlagsBits as P} from 'discord.js';
import {plan,getState,setState} from './db.js';
import {tierBrandingProfile} from './tier-branding-profiles.js';
const stateKey='tier-branding:v1',originalKey='tier-branding:original';
const snowflake=id=>/^\d{17,22}$/.test(id||'');
const identity=p=>p.tier+':'+p.revision;
// Branding reads the same server-specific effective plan as command authorization.
// It never grants access and never modifies the global bot user/avatar.
export class TierBranding {
 constructor(client,{planFor=plan,profileFor=tierBrandingProfile,readState=getState,writeState=setState,now=Date.now,log=(name,detail)=>console.log(name,JSON.stringify(detail)),pollMs=2000}={}){
  Object.assign(this,{client,planFor,profileFor,readState,writeState,now,log,pollMs});
  this.pending=new Set();this.observed=new Map();this.retry=new Map();this.draining=null;this.stopped=false;
 }
 desired(id){return this.profileFor(this.planFor(id));}
 knownGuild(id){return snowflake(id)&&this.client.guilds.cache.get(id);}
 matches(id,desired=this.desired(id)){
  const saved=this.readState(id,stateKey),actual=this.observed.get(id);
  return !!(actual&&saved&&saved.user===this.client.user.id&&saved.tier===desired.tier&&saved.revision===desired.revision&&saved.avatar&&saved.avatar===actual.avatar&&actual.nick===desired.nickname);
 }
 request(id){
  if(this.stopped||!this.knownGuild(id)||!this.client.isReady())return Promise.resolve();
  const delayed=this.retry.get(id);if(delayed&&delayed.identity===identity(this.desired(id))&&delayed.after>this.now())return Promise.resolve();
  this.pending.add(id);
  if(!this.draining)this.draining=this.drain().finally(()=>{this.draining=null;if(this.pending.size&&!this.stopped)this.request(this.pending.values().next().value);});
  return this.draining;
 }
 async tick(){
  if(this.stopped||!this.client.isReady())return;
  for(const g of this.client.guilds.cache.values())if(g.available!==false&&!this.matches(g.id))this.request(g.id);
  await this.draining;
 }
 async drain(){
  while(this.pending.size&&!this.stopped){
   const id=this.pending.values().next().value;this.pending.delete(id);
   const g=this.knownGuild(id);if(!g||g.available===false)continue;
   let desired;
   try{
    desired=this.desired(id);const delayed=this.retry.get(id);if(delayed&&delayed.identity===identity(desired)&&delayed.after>this.now())continue;if(this.matches(id,desired))continue;
    let actual=this.observed.get(id);
    if(!actual){const result=await this.client.rest.get(Routes.guildMember(id,this.client.user.id));actual={nick:result.nick??null,avatar:result.avatar??null};this.observed.set(id,actual);}
    // A queued purchase, renewal or expiry may have changed during the fetch.
    if(!this.knownGuild(id))continue;desired=this.desired(id);
    if(this.matches(id,desired)){this.retry.delete(id);this.log('VEX_TIER_BRANDING_VERIFIED',{guild:id,tier:desired.tier,nickname:actual.nick,avatar:actual.avatar,unchanged:true});continue;}
    if(!this.readState(id,originalKey))this.writeState(id,originalKey,{user:this.client.user.id,nickname:actual.nick,avatar:actual.avatar,at:this.now()});
    const saved=this.readState(id,stateKey),avatarMatches=saved?.user===this.client.user.id&&saved.tier===desired.tier&&saved.revision===desired.revision&&saved.avatar===actual.avatar&&!!actual.avatar;
    const canRename=g.members?.me?.permissions?.has(P.ChangeNickname)!==false;
    const body={};if(!avatarMatches)body.avatar=desired.avatar;if(actual.nick!==desired.nickname&&canRename)body.nick=desired.nickname;
    if(!Object.keys(body).length){const e=Error('Change Nickname permission required');e.code='CHANGE_NICKNAME_REQUIRED';throw e;}
    const result=await this.client.rest.patch(Routes.guildMember(id,'@me'),{body,reason:'VEX '+desired.tier+' server plan branding'});
    if(!result.avatar||body.nick&&result.nick!==desired.nickname||result.user?.id&&result.user.id!==this.client.user.id)throw Error('Discord did not confirm the requested server profile');
    actual={nick:result.nick??null,avatar:result.avatar};this.observed.set(id,actual);
    this.writeState(id,stateKey,{user:this.client.user.id,tier:desired.tier,revision:desired.revision,nickname:actual.nick,avatar:actual.avatar,appliedAt:this.now()});
    const complete=actual.nick===desired.nickname;
    this.log('VEX_TIER_BRANDING_APPLIED',{guild:id,tier:desired.tier,nickname:actual.nick,avatar:actual.avatar,complete});
    if(complete)this.retry.delete(id);else this.failure(id,desired,{code:'CHANGE_NICKNAME_REQUIRED'});
    // Expiry during an in-flight request must immediately replace the stale paid identity.
    if(identity(this.desired(id))!==identity(desired))this.pending.add(id);
   }catch(e){if(desired)this.failure(id,desired,e);else this.log('VEX_TIER_BRANDING_FAILED',{guild:id,code:e.code||e.name});}
  }
 }
 failure(id,desired,error){
  const old=this.retry.get(id),failures=old?.identity===identity(desired)?old.failures+1:1;
  const delay=Math.min(15*60000,30000*2**Math.min(failures-1,5));
  this.retry.set(id,{identity:identity(desired),failures,after:this.now()+delay});
  // Only report the code; REST request bodies contain avatar bytes and must not be logged.
  this.log('VEX_TIER_BRANDING_FAILED',{guild:id,tier:desired.tier,code:error.code||error.name||'PROFILE_UPDATE_FAILED',retrySeconds:delay/1000});
 }
 observe(member){
  if(member.id!==this.client.user?.id||!this.knownGuild(member.guild.id))return;
  this.observed.set(member.guild.id,{nick:member.nickname??null,avatar:member.avatar??null});
  // A restored Change Nickname permission should not wait for the old failure cooldown.
  if(member.permissions?.has(P.ChangeNickname))this.retry.delete(member.guild.id);
  void this.request(member.guild.id);
 }
 forget(id){this.pending.delete(id);this.observed.delete(id);this.retry.delete(id);}
 snapshot(){return [...this.client.guilds.cache.values()].map(g=>({guild:g.id,effective:this.planFor(g.id),nickname:this.observed.get(g.id)?.nick??null,avatar:this.observed.get(g.id)?.avatar??null,matched:this.matches(g.id),retrying:this.retry.has(g.id)}));}
 start(){
  void this.tick().catch(e=>this.log('VEX_TIER_BRANDING_TICK_FAILED',{code:e.code||e.name}));
  this.timer=setInterval(()=>{void this.tick().catch(e=>this.log('VEX_TIER_BRANDING_TICK_FAILED',{code:e.code||e.name}));},this.pollMs);this.timer.unref?.();
 }
 stop(){this.stopped=true;clearInterval(this.timer);this.pending.clear();}
}
const controllers=new WeakMap();
export function attachTierBranding(client){
 if(controllers.has(client))return controllers.get(client);
 const service=new TierBranding(client);controllers.set(client,service);
 client.once('clientReady',()=>{service.start();const timer=setTimeout(()=>console.log('VEX_TIER_BRANDING_AUDIT',JSON.stringify({profiles:service.snapshot()})),30000);timer.unref();});
 client.on('guildCreate',g=>{service.forget(g.id);void service.request(g.id);});
 client.on('guildAvailable',g=>{service.forget(g.id);void service.request(g.id);});
 client.on('guildDelete',g=>service.forget(g.id));
 client.on('guildMemberUpdate',(_old,member)=>service.observe(member));
 console.log('VEX server plan branding installed: Basic / Plus / Ultimate avatars and nicknames.');
 return service;
}
