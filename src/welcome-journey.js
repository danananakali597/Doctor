import {ActionRowBuilder,ButtonBuilder,ButtonStyle,Events} from 'discord.js';
import {settings,getState,setState,saveSettings} from './db.js';
import {journeyProgress} from './journey-state.js';
const prefixes=['vex:journey:'];
const labelAction=label=>/say hi/i.test(label)?'hi':/read rules/i.test(label)?'rules':/journey complete/i.test(label)?'complete':/^get started$/i.test(label)?'start':null;
export function journeyAction(i){
 if(i.customId?.startsWith(prefixes[0])){const [, ,action,owner]=i.customId.split(':');return {action,owner};}
 if(i.message?.author?.id!==i.client.user?.id)return null;
 const b=i.message.components?.flatMap(r=>r.components).find(b=>b.customId===i.customId),action=labelAction(b?.label||'');
 if(!action)return null;
 const owner=i.customId?.match(/(?:^|[:_])([0-9]{17,22})(?:$|[:_])/)?.[1];
 return {action,owner};
}
const channelLink=(g,id)=>`https://discord.com/channels/${g.id}/${id}`;
const button=(label,action,id,style=ButtonStyle.Secondary)=>new ButtonBuilder().setLabel(label).setStyle(style).setCustomId(`vex:journey:${action}:${id}`);
export function decorateWelcome(payload,g,c,m){
 const rows=(payload.components||[]).map(r=>r.toJSON?r.toJSON():r).map(r=>({...r,components:r.components.filter(b=>!labelAction(b.label||'')&&!/choose roles/i.test(b.label||''))})).filter(r=>r.components.length);
 if(c.journeyEnabled===false)return {...payload,components:rows.slice(0,5).map(r=>ActionRowBuilder.from(r))};
 const controls=[];
 if(c.sayHiEnabled&&c.chatChannelId)controls.push(new ButtonBuilder().setLabel('👋 Say Hi').setStyle(ButtonStyle.Link).setURL(channelLink(g,c.chatChannelId)));
 if(c.rulesChannelId)controls.push(new ButtonBuilder().setLabel('📜 Read Rules').setStyle(ButtonStyle.Link).setURL(channelLink(g,c.rulesChannelId)));
 controls.push(button('Get Started','start',m.id,ButtonStyle.Primary));
 return {...payload,components:[...rows.slice(0,4).map(r=>ActionRowBuilder.from(r)),new ActionRowBuilder().addComponents(...controls)]};
}
export function journeyState(g,m){const key='welcome:journey:'+m.id;const joined=m.joinedTimestamp||0;let state=getState(g.id,key,{});if(state.joined!==joined)state={joined};return {key,state};}
const panels=new Map(),pending=new Map();
function panel(i,m,c,state){
 const roles=settings(i.guildId).community.selfroles;
 const hasRoles=!roles.enabled||!(roles.roleIds||[]).length||(roles.roleIds||[]).some(id=>m.roles.cache.has(id));
 const p=journeyProgress(state,c,hasRoles),mark=x=>x?'✅':'○';
 const rows=[];
 if(!p.complete){const buttons=[];
  if(!p.rules)buttons.push(button('I have read the rules','ack',m.id));
  if(!p.roles){if(roles.channelId)buttons.push(new ButtonBuilder().setLabel('Choose Roles').setStyle(ButtonStyle.Link).setURL(channelLink(i.guild,roles.channelId)));buttons.push(button('Skip optional roles','skip',m.id));}
  buttons.push(button('Check progress','check',m.id,ButtonStyle.Primary));rows.push(new ActionRowBuilder().addComponents(...buttons));
 }else rows.push(new ActionRowBuilder().addComponents(button('✅ Journey complete','complete',m.id,ButtonStyle.Success).setDisabled(true)));
 return {progress:p,payload:{embeds:[{title:p.complete?'Welcome journey complete':'Your welcome journey',description:`${mark(p.rules)} Rules ${c.rulesChannelId?'acknowledgement':'not required'}\n${mark(p.roles)} Optional community roles\n${mark(p.intro)} ${c.sayHiEnabled?'Write your own first message in <#'+c.chatChannelId+'>':'Introduction not required'}\n\n${p.complete?'You are ready to explore.':'Open the configured channels, then check your progress.'}`,color:0x8270f5,thumbnail:{url:m.user.displayAvatarURL({size:128})},footer:{text:'VEX • Personal onboarding'}}],components:rows,allowedMentions:{parse:[]}}};
}
async function handle(i){
 const a=journeyAction(i);if(!a)return;
 if(!i.inGuild())return i.reply({content:'Open this journey inside the server.',ephemeral:true});
 if(!a.owner||a.owner!==i.user.id)return i.reply({content:'This welcome journey belongs to another member. Open your own welcome card.',ephemeral:true});
 await i.deferUpdate();
 const m=await i.guild.members.fetch({user:i.user.id,force:true}),c=settings(i.guildId).community.welcome;
 if(c.journeyEnabled===false)return i.followUp({content:'The server owner has disabled this journey.',ephemeral:true});
 if(a.action==='hi'||a.action==='rules'){const id=a.action==='hi'&&c.sayHiEnabled?c.chatChannelId:a.action==='rules'?c.rulesChannelId:null;return i.followUp({content:id?channelLink(i.guild,id):'The server owner has not configured this channel.',ephemeral:true});}
 const {key,state}=journeyState(i.guild,m);
 if(a.action==='ack'&&c.rulesChannelId){const channel=i.guild.channels.cache.get(c.rulesChannelId);if(channel?.permissionsFor(m)?.has('ViewChannel'))state.rules=true;}
 if(a.action==='skip')state.roles=true;
 const {progress,payload}=panel(i,m,c,state),cacheKey=i.guildId+':'+i.user.id;
 if(state.complete&&a.action==='complete'){if(i.message.flags?.has(64))await i.editReply(payload);return;}
 state.complete=progress.complete;setState(i.guildId,key,state);
 const cached=panels.get(cacheKey);
 if(i.message.flags?.has(64)){await i.editReply(payload);panels.set(cacheKey,{createdTimestamp:i.createdTimestamp,editReply:p=>i.editReply(p)});}
 else if(cached&&Date.now()-cached.createdTimestamp<14*60000){try{await cached.editReply(payload);}catch{panels.delete(cacheKey);const msg=await i.followUp({...payload,ephemeral:true});panels.set(cacheKey,{createdTimestamp:Date.now(),editReply:p=>i.webhook.editMessage(msg.id,p)});}}
 else {const msg=await i.followUp({...payload,ephemeral:true});panels.set(cacheKey,{createdTimestamp:Date.now(),editReply:p=>i.webhook.editMessage(msg.id,p)});}
 if(progress.complete&&!i.message.flags?.has(64)){
  const rows=i.message.components.map(r=>ActionRowBuilder.from(r));
  for(const row of rows)for(const b of row.components)if(b.data.custom_id===i.customId)b.setLabel('✅ Journey complete').setDisabled(true);
  await i.message.edit({components:rows}).catch(()=>{});
 }
 for(const [k,v]of panels)if(Date.now()-v.createdTimestamp>14*60000)panels.delete(k);
}
export function attachWelcomeJourney(client){
 client.once(Events.ClientReady,async()=>{
  const g=client.guilds.cache.get('1557341885649920002');if(!g)return;
  const cfg=settings(g.id).community.welcome;
  if(!getState(g.id,'welcome:configured-v2')){
   const chat=g.channels.cache.find(c=>c.type===0&&/^(?:general|general-chat)$/.test(c.name)),rules=g.rulesChannel||g.channels.cache.find(c=>[0,5].includes(c.type)&&c.name==='rules');
   saveSettings(g.id,{community:{welcome:{journeyEnabled:true,...(chat?{sayHiEnabled:true,chatChannelId:chat.id}:{}),...(rules?{rulesChannelId:rules.id}:{})}}});setState(g.id,'welcome:configured-v2',true);
  }
  const c=settings(g.id).community.welcome,channel=g.channels.cache.get(c.channelId);if(!channel?.messages)return;
  try{const messages=await channel.messages.fetch({limit:50});let updated=0;
   for(const message of messages.values()){
    if(message.author.id!==client.user.id||!message.components.some(r=>r.components.some(b=>labelAction(b.label||''))))continue;
    const ids=message.components.flatMap(r=>r.components).map(b=>b.customId?.match(/(?:^|[:_])([0-9]{17,22})(?:$|[:_])/)?.[1]).filter(Boolean);
    const owner=ids[0];if(!owner||ids.some(id=>id!==owner))continue;
    const m=await g.members.fetch(owner).catch(()=>null);if(!m)continue;
    const payload=decorateWelcome({components:message.components},g,c,m);await message.edit({components:payload.components});updated++;
   }console.log('VEX_WELCOME_REFRESH',JSON.stringify({updated,chatConfigured:!!c.chatChannelId,rulesConfigured:!!c.rulesChannelId}));
  }catch(e){console.warn('Welcome refresh:',e.code||e.name);}
 });
 for(const listener of client.listeners(Events.InteractionCreate)){client.removeListener(Events.InteractionCreate,listener);client.on(Events.InteractionCreate,function(i){if(!journeyAction(i))return listener.call(this,i);});}
 client.on(Events.InteractionCreate,i=>{if(!journeyAction(i))return;const key=i.guildId+':'+i.user.id;const task=(pending.get(key)||Promise.resolve()).then(()=>handle(i)).catch(e=>console.warn('Welcome journey:',e.code||e.name));pending.set(key,task);task.finally(()=>{if(pending.get(key)===task)pending.delete(key);});});
 client.on(Events.MessageCreate,m=>{if(!m.guild||m.author.bot||!m.member)return;const c=settings(m.guildId).community.welcome;if(c.journeyEnabled===false||!c.sayHiEnabled||m.channelId!==c.chatChannelId)return;const {key,state}=journeyState(m.guild,m.member);if(!state.intro){state.intro=true;setState(m.guildId,key,state);}});
}
