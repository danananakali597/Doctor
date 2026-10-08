import {settings,plan,event,getState,setState} from './db.js';
import {hasFeature} from './plan-catalog.js';
import {classifySecurity,securityProviderReady} from './security-openai.js';
import {budgetStatus} from './security-budget.js';
import {WindowCounter} from './rules.js';
const checks=new WindowCounter(),busy=new Set();let concurrent=0;
export const automatedResponses=g=>settings(g).securitySuite.mode==='enforce';
export function securitySuiteStatus(g){const s=settings(g),ai=s.securitySuite.ai;return {mode:s.securitySuite.mode,available:hasFeature(plan(g),'aiSecurity'),configured:securityProviderReady(),aiEnabled:ai.enabled,paidReview:ai.paidReview,budget:budgetStatus(g,ai),model:'gpt-4.1-mini',moderationModel:'omni-moderation-latest',last:getState(g,'security-ai-status',null)};}
function status(g,value){setState(g,'security-ai-status',{...value,at:Date.now()});}
export async function inspectSecurityAI(m,s,record){
 const c=s.securitySuite.ai;if(!c.enabled||s.securitySuite.mode==='paused'||!hasFeature(plan(m.guildId),'aiSecurity'))return;
 if(checks.hit(m.guildId,60).length>c.maxChecksPerMinute){status(m.guildId,{status:'rate_limited'});return;}
 const lock=m.guildId+':'+m.id;if(busy.has(lock)||concurrent>=8){status(m.guildId,{status:'busy'});return;}busy.add(lock);concurrent++;
 try{
  const snapshot={content:m.content||'',editedTimestamp:m.editedTimestamp,attachments:[...(m.attachments?.keys()||[])].sort().join(',')};
  let context=[];if(c.context&&c.paidReview&&m.content){const recent=await m.channel.messages.fetch({before:m.id,limit:3}).catch(()=>null);context=recent?[...recent.values()].filter(x=>!x.author?.bot).reverse().map(x=>x.content.slice(0,500)):[];}
  const result=await classifySecurity(m.guildId,{...c,language:s.securitySuite.language},{content:m.content||'',attachments:[...(m.attachments?.values()||[])],context});status(m.guildId,{status:result.status,reviewStatus:result.reviewStatus||null,source:result.source||null,cached:!!result.cached});
  if(result.status!=='ok'||!result.violation&&!result.needsReview)return;
  // Recheck live policy/entitlement after the provider call; never act on stale settings.
  const live=settings(m.guildId);if(!hasFeature(plan(m.guildId),'aiSecurity')||!live.securitySuite.ai.enabled||live.securitySuite.mode==='paused'||JSON.stringify(live.securitySuite)!==JSON.stringify(s.securitySuite))return;
  const current=await m.channel.messages.fetch(m.id).catch(()=>null);if(!current||(current.content||'')!==snapshot.content||current.editedTimestamp!==snapshot.editedTimestamp||[...(current.attachments?.keys()||[])].sort().join(',')!==snapshot.attachments)return;
  const member=await m.guild.members.fetch({user:m.author.id,force:true}).catch(()=>null);if(!member||member.id===m.guild.ownerId||live.exemptChannels.includes(m.channelId)||member.roles.cache.some(r=>live.exemptRoles.includes(r.id))||live.modules.trust?.enabled&&(live.trustedUsers.includes(member.id)||member.roles.cache.some(r=>live.trustedRoles.includes(r.id))))return;
  let outcome='review only';
  if(result.violation&&live.securitySuite.mode==='enforce'&&c.action!=='log'){
   const deleted=await current.delete().then(()=>true).catch(()=>false);outcome=deleted?'message deleted':'delete failed';
   if(c.action==='timeout'&&deleted&&member.moderatable){const until=Date.now()+c.timeoutMinutes*60000;if((member.communicationDisabledUntilTimestamp||0)<until){const previous=member.communicationDisabledUntilTimestamp||null;try{await member.timeout(c.timeoutMinutes*60000,'VEX AI Security: '+result.category);setState(m.guildId,'security-ai-timeout:'+m.id,{member:member.id,until,previous});outcome+='; timed out';}catch{outcome+='; timeout failed';}}else outcome+='; longer timeout preserved';}
  }
  await record(m.guild,result.violation?'ai_security_violation':'ai_security_incident',{actor:member.id,channel:m.channelId,message:m.id,rules:result.category,reason:result.reason,source:result.source,score:result.score,result:outcome,mode:live.securitySuite.mode},true);
 }finally{busy.delete(lock);concurrent--;}
}
export async function releaseSecurityTimeout(g,id,actor){
 const incident=(await import('./db.js')).events(g.id,10000).find(e=>e.id===id&&e.kind==='ai_security_violation');if(!incident)throw Error('AI incident not found');
 const saved=getState(g.id,'security-ai-timeout:'+incident.detail.message);if(!saved)throw Error('No VEX AI timeout for this incident');
 const member=await g.members.fetch({user:saved.member,force:true});if(actor.id!==g.ownerId&&actor.roles.highest.comparePositionTo(member.roles.highest)<=0)throw Error('Your role must be above the target');
 if(!member.moderatable||Math.abs((member.communicationDisabledUntilTimestamp||0)-saved.until)>5000)throw Error('Timeout changed or member cannot be moderated; review in Discord');
 await member.timeout(saved.previous&&saved.previous>Date.now()?saved.previous-Date.now():null,'VEX AI incident reviewed');setState(g.id,'security-ai-timeout:'+incident.detail.message,null);event(g.id,'ai_security_timeout_released',{actor:actor.id,target:member.id,incident:id});return {ok:true};
}
