import {AttachmentBuilder,escapeMarkdown} from 'discord.js';
import {commandProfiles,profileFor} from './command-profiles.js';
import {sessionFor} from './command-core.js';
import {env} from './config.js';
import {basename} from 'node:path';
const V2=32768,PRIVATE=64;
const json=v=>v?.toJSON?v.toJSON():v;
export function componentCount(values){return (values||[]).reduce((n,c)=>n+1+componentCount(c.components)+(c.accessory?componentCount([c.accessory]):0)+(c.items?.length||0),0);}
const bits=v=>Number(v?.bitfield??v??0);
const text=content=>({type:10,content});
const separator=()=>({type:14,divider:true,spacing:1});
const names={deck:'CONTROL DECK',guide:'GETTING STARTED',atlas:'COMMAND ATLAS',coverage:'PROTECTION COVERAGE',identity:'MEMBER CHECK',diagnostics:'DIAGNOSTIC FINDINGS',emergency:'EMERGENCY OPERATIONS',milestone:'XP MILESTONE',podium:'COMMUNITY PODIUM',spotlight:'TOP TEN SPOTLIGHT',collection:'YOUR ROLE COLLECTION',palette:'AVAILABLE COLOR PALETTE',signature:'COLOR SIGNATURE',pass:'INVITATION PASS',constellation:'COMMUNITY HIGHLIGHTS',arrival:'ARRIVAL EXPERIENCE',support:'SUPPORT REQUEST',suite:'PERSONAL VOICE SUITE',route:'YOUR VOICE ROUTE',transfer:'VOICE TRANSFER',disconnect:'VOICE DISCONNECT',workspace:'MODERATION WORKSPACE',archive:'CASE ARCHIVE',ledger:'ACTIVE WARNING LEDGER',retraction:'WARNING RETRACTION',advisory:'MEMBER ADVISORY',restriction:'COMMUNICATION RESTRICTION',restoration:'COMMUNICATION RESTORATION',exit:'SERVER EXIT',block:'SERVER ACCESS BLOCK',return:'SERVER ACCESS RESTORATION',cleanup:'MESSAGE CLEANUP',tempo:'CONVERSATION TEMPO',pause:'CHANNEL PAUSE',resume:'CHANNEL RESUME','identity-edit':'MEMBER IDENTITY',assignment:'ROLE ASSIGNMENT','xp-adjustment':'XP TOTAL ADJUSTMENT',calibration:'LEVEL CALIBRATION',reset:'XP RESET',cinema:'CINEMA LAUNCHPAD',conversation:'AI RESPONSE',intelligence:'SECURITY INTELLIGENCE',stream:'ACTIVITY EVENT STREAM'};
const sourceInMessage=m=>{
 const all=[];const walk=cs=>{for(const c of cs||[]){const j=json(c);if(j.content)all.push(j.content);walk(j.components);}};walk(m?.components);
 const combined=all.join('\n');return combined.match(/VEX · \/([\w-]+) ·/u)?.[1]||(combined.includes('VEX · Cinema Activity ·')?'launch':null);
};
export function commandForInteraction(i){
 if(profileFor(i.vexCommandName||i.commandName))return i.vexCommandName||i.commandName;
 const id=i.customId||'';
 if(id.startsWith('vex:core:')){
  const [, , , ,verb,arg]=id.split(':');
  if(['confirm','reason','action','target','cancel','case'].includes(verb)){try{const s=sessionFor(arg,i);return verb==='case'?'cases':s.action||s.policy||'moderate';}catch{}}
  const direct={rank:'rank',top:'leaderboard',scan:'scan',welcome:'welcome',cases:'cases',start:'moderate'}[verb];if(direct)return direct;
  if(verb==='nav')return {home:'vex',security:'security',community:'vex',moderation:'moderate',logs:'logs',support:'ticket',voice:'room',ai:'ask',games:'launch'}[arg||i.values?.[0]]||'vex';
 }
 const prefix={roles:'roles',ticket:'ticket',room:'room',welcome:'welcome',journey:'welcome',guide:'commands'}[id.split(':')[1]];
 return prefix||sourceInMessage(i.message)||null;
}
function titleFor(name,i){const p=profileFor(name);return i?.vexLocale==='ckb'||i?.options?.getString?.('language')==='ckb'?p.ckb:p.label;}
// Preserve returned data and native controls. This layer does not execute actions.
export function presentCommand(payload,name,{interaction={},privateResponse=true,editing=false}={}){
 const p=profileFor(name);if(!p||!privateResponse||!payload)return payload;
 if(typeof payload==='string')payload={content:payload};
 if(payload.poll||payload.stickers||bits(payload.flags)&V2||(payload.components||[]).some(c=>[9,10,12,13,14,17].includes(json(c).type)))return payload;
 const embeds=(payload.embeds||[]).map(json),rows=(payload.components||[]).map(json);
 if(rows.some(r=>r.type!==1))return payload;
 // Do not strip or retitle control-only edits; Discord keeps the existing card.
 if(!embeds.length&&!payload.content&&!payload.files?.length)return payload;
 const children=[],media=[],notes=[],files=[...(payload.files||[])];
 const heading=`### ${p.icon} ${titleFor(name,interaction)}\n-# VEX / ${names[p.layout]}`;
 const thumb=embeds.find(e=>e.thumbnail?.url)?.thumbnail?.url;
 if(thumb)children.push({type:9,components:[text(heading)],accessory:{type:11,media:{url:thumb},description:p.label}});else children.push(text(heading));
 children.push(separator());
 if(payload.content)children.push(text(String(payload.content)));
 const ranked=['podium','spotlight'].includes(p.layout),record=['archive','ledger','stream'].includes(p.layout);
 for(const e of embeds){
  if(e.title)children.push(text(`**${e.url?'['+e.title+']('+e.url+')':e.title}**`));
  if(e.description){
   let body=e.description;
   if(ranked)body=body.split('\n').map((line,n)=>line&&n<3?`${['🥇','🥈','🥉'][n]} ${line}`:line).join('\n');
   if(p.layout==='diagnostics'){
    const checks=body.split('\n').filter(l=>/^[✓⚠]/.test(l));
    if(checks.length)children.push(text(`**${checks.filter(l=>l.startsWith('✓')).length} / ${checks.length} configuration checks passed**`));
   }
   if(p.layout==='podium'&&body.split('\n').length>3){
    const lines=body.split('\n');for(const leader of lines.slice(0,3))children.push(text(leader));
    children.push(separator(),text(lines.slice(3).join('\n')));
   }else if(record&&body.includes('\n\n'))for(const block of body.split('\n\n'))children.push(text(block));else children.push(text(body));
  }
  if(e.fields?.length){
   const label=p.layout==='milestone'?'YOUR PROGRESS':p.layout==='pass'?'PASS DETAILS':p.layout==='suite'?'ROOM CONTROLS':p.layout==='stream'?'EVENT ROUTING':p.layout==='coverage'?'PROTECTION SIGNALS':p.layout==='assignment'?'MEMBER & ROLE':p.layout==='transfer'?'TRANSFER DETAILS':p.layout==='restriction'?'DURATION & TARGET':p.layout==='cleanup'?'DELETION SCOPE':p.layout==='intelligence'?'REVIEW EVIDENCE':'DETAILS';
   children.push(separator(),text(`-# ${label}\n`+e.fields.map(f=>`**${f.name}**\n${f.value}`).join('\n\n')));
  }
  if(e.image?.url)media.push({media:{url:e.image.url},description:e.title?.slice(0,200)||p.label});
  if(e.footer?.text)notes.push(e.footer.text);
  if(e.timestamp)notes.push(`<t:${Math.floor(new Date(e.timestamp).getTime()/1000)}:f>`);
 }
 if(media.length){const gallery={type:12,items:media.slice(0,10)};if(['arrival','cinema'].includes(p.layout))children.splice(Math.min(3,children.length),0,gallery);else children.push(gallery);}
 const filename=f=>f.name||f.data?.name||basename(typeof f==='string'?f:typeof f.attachment==='string'?f.attachment:f.attachment?.path||f.path||'file.jpg');
 const existingNames=[...new Set([...files.map(filename),...(payload.attachments||[]).map(f=>f.name).filter(Boolean)])];
 for(const fileName of existingNames)if(!media.some(m=>m.media.url===`attachment://${fileName}`))children.push({type:13,file:{url:`attachment://${fileName}`}});
 const totalText=children.filter(c=>c.type===10).map(c=>c.content).join('\n\n');
 // Discord has a combined 4,000-character Text Display budget. Keep long results intact in a file.
 if(totalText.length+heading.length>3500||componentCount(children)+componentCount(rows)>35){
  const transcript=[payload.content,...embeds.flatMap(e=>[e.title,e.description,...(e.fields||[]).map(f=>f.name+'\n'+f.value),e.url])].filter(Boolean).join('\n\n');
  const filename=`vex-${name}-${Date.now()}.txt`;files.push(new AttachmentBuilder(Buffer.from(transcript,'utf8'),{name:filename}));
  children.splice(2,children.length-2,text(transcript.slice(0,1800)+'\n\n**Full result attached below.**'),{type:13,file:{url:`attachment://${filename}`}});
  if(media.length)children.push({type:12,items:media.slice(0,10)});
  for(const fileName of existingNames)if(!media.some(m=>m.media.url===`attachment://${fileName}`))children.push({type:13,file:{url:`attachment://${fileName}`}});
 }
 const commandLabel=name==='launch'?'Cinema Activity':'/'+name;
 children.push(separator(),text(`-# VEX · ${commandLabel} · ${p.icon} ${names[p.layout]}${notes.length?'\n'+notes.map(n=>escapeMarkdown(n)).join(' · ').slice(0,220):''}`));
 if(interaction.user?.id&&interaction.guildId&&!['help','commands'].includes(name)){
  const locale=['en','ckb','ar','tr'].includes(interaction.vexLocale)?interaction.vexLocale:'en';
  const id=(verb,arg)=>`vex:atlas:${interaction.user.id}:${interaction.guildId}:${locale}:${verb}:${arg}`;
  const nav={type:1,components:[{type:2,style:2,label:locale==='ckb'?'ڕێبەری '+commandLabel:'Guide '+commandLabel,custom_id:id('open',name)},{type:2,style:2,label:locale==='ckb'?'کۆماندەکان':'Command Atlas',custom_id:id('category','all')},{type:2,style:5,label:locale==='ckb'?'ڕێکخستنەکان':'Settings',url:env.publicUrl+'/?guild='+interaction.guildId+'&section='+encodeURIComponent(p.section)}]};
  if(componentCount(children)+componentCount(rows)+componentCount([nav])+1<=40)rows.push(nav);
 }
 const out={...payload,components:[{type:17,accent_color:p.color,components:children},...rows],allowedMentions:payload.allowedMentions||{parse:[]},flags:bits(payload.flags)|V2};
 if(files.length)out.files=files;
 // Explicitly clear legacy data when converting an existing reply to V2.
 if(editing){out.content=null;out.embeds=[];}else{delete out.content;delete out.embeds;}
 if(out.ephemeral){out.flags|=PRIVATE;delete out.ephemeral;}
 return out;
}
const wrapped=new WeakSet();
export function wrapCommandInteraction(i){
 if(wrapped.has(i))return;wrapped.add(i);let deferredPrivate=false;
 const privateNativeFollowups=new Set();
 if(typeof i.deferReply==='function'){const original=i.deferReply.bind(i);i.deferReply=options=>{deferredPrivate=!!(options?.ephemeral||bits(options?.flags)&PRIVATE);return original(options);};}
 for(const method of ['reply','editReply','followUp','update']){
  if(typeof i[method]!=='function')continue;const original=i[method].bind(i);
  i[method]=async payload=>{
   const name=commandForInteraction(i),privateResponse=method==='reply'||method==='followUp'?!!(payload?.ephemeral||bits(payload?.flags)&PRIVATE):!!(deferredPrivate||i.ephemeral||bits(i.message?.flags)&PRIVATE);
   const rendered=presentCommand(payload,name,{interaction:i,privateResponse,editing:method==='editReply'||method==='update'});
   const result=await original(rendered);
   if(method==='followUp'&&privateResponse&&(bits(rendered?.flags)&V2)&&result?.id)privateNativeFollowups.add(result.id);
   return result;
  };
 }
 // Personal onboarding caches follow-up webhook editors. Keep subsequent edits native too.
 if(typeof i.webhook?.editMessage==='function'){
  const original=i.webhook.editMessage.bind(i.webhook);
  i.webhook.editMessage=(id,payload)=>original(id,privateNativeFollowups.has(String(id))?presentCommand(payload,commandForInteraction(i),{interaction:i,privateResponse:true,editing:true}):payload);
 }
 if(typeof i.showModal==='function'){const original=i.showModal.bind(i);i.showModal=modal=>{
  const data=json(modal),name=commandForInteraction(i);if(!name)return original(modal);
  const components=(data.components||[]).map(row=>row.type===1&&row.components?.length===1&&row.components[0].type===4?(()=>{const input={...row.components[0]},label=input.label;delete input.label;return {type:18,label,component:input};})():row);
  return original({...data,components});
 };}
}
export {V2 as commandComponentsFlag};
