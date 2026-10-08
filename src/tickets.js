import {deferPrivate,respondPrivate} from './interaction-response.js';
import './community-store.js';
import {ActionRowBuilder,AttachmentBuilder,ButtonBuilder,ButtonStyle,ChannelType,EmbedBuilder,Events,ModalBuilder,PermissionFlagsBits as P,StringSelectMenuBuilder,TextInputBuilder,TextInputStyle,UserSelectMenuBuilder} from 'discord.js';
import {fileURLToPath} from 'node:url';
import {db,event,events,getState,setState,settings} from './db.js';
import {requireFeature} from './feature-policy.js';

export const ticketTopics=Object.freeze([
 {id:'technical',label:'Technical help',name:'Technical Support',emoji:'⚙️',description:'Get help with setup, commands, or issues.'},
 {id:'billing',label:'Billing & VIP',name:'Billing & VIP',emoji:'💳',description:'Questions about payments, subscriptions, or perks.'},
 {id:'reports',label:'Reports & suggestions',name:'Reports & Suggestions',emoji:'💡',description:'Report issues or share ideas to improve VEX.'}
]);
db.exec(`CREATE TABLE IF NOT EXISTS ticket_details(channel TEXT PRIMARY KEY,guild TEXT NOT NULL,number INTEGER NOT NULL,topic_type TEXT NOT NULL,topic TEXT NOT NULL,card_message TEXT NOT NULL DEFAULT '',UNIQUE(guild,number));
CREATE TABLE IF NOT EXISTS ticket_sequence(guild TEXT PRIMARY KEY,next INTEGER NOT NULL);`);
const asset=name=>fileURLToPath(new URL('../public/assets/tickets/'+name,import.meta.url));
const topic=id=>ticketTopics.find(x=>x.id===id);
const cfg=g=>settings(g).community.tickets;
const noMentions={parse:[]};
const reply=(title,text)=>({embeds:[new EmbedBuilder().setColor(0x9870f5).setTitle(title).setDescription(text).setFooter({text:'VEX • Private support'})],allowedMentions:noMentions});
const locks=new Set();
async function exclusive(key,fn){if(locks.has(key))throw Error('A ticket update is already running. Please retry.');locks.add(key);try{return await fn();}finally{locks.delete(key);}}
const number=db.transaction(g=>{db.prepare('INSERT INTO ticket_sequence(guild,next) VALUES(?,1) ON CONFLICT(guild) DO NOTHING').run(g);const n=db.prepare('SELECT next FROM ticket_sequence WHERE guild=?').get(g).next;db.prepare('UPDATE ticket_sequence SET next=next+1 WHERE guild=?').run(g);return n;});
export function ticketPanel(config={}){
 const title=!config.title||config.title==='How can we help?'?'Support Center':config.title;
 const description=!config.message||config.message==='Open a private ticket to speak with our team.'?'Choose a topic. We will guide you from here.':config.message;
 return {embeds:[new EmbedBuilder().setColor(0x9870f5).setImage('attachment://vex-support.png'),new EmbedBuilder().setColor(0x9870f5).setTitle(title).setDescription(description+'\n\n'+ticketTopics.map(t=>`${t.emoji} **${t.label}**\n${t.description}`).join('\n\n'))],files:[new AttachmentBuilder(asset('vex-support.png'),{name:'vex-support.png'})],components:[new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('vex:ticket:topic').setPlaceholder('Select a support topic').addOptions(ticketTopics.map(t=>({label:t.label,value:t.id,emoji:t.emoji,description:t.description}))))],allowedMentions:noMentions};
}
export function ticketCard(row,detail){
 const closed=row.status==='closed',stage=closed?'resolved':row.claimed?'reviewing':'opened';
 const label=closed?'Resolved / closed':row.claimed?'In progress':'Waiting for support';
 return {embeds:[new EmbedBuilder().setColor(closed?0x2ecc71:row.claimed?0x3498db:0xf39c12).setTitle('Ticket #'+String(detail.number).padStart(4,'0')).setDescription(topic(detail.topic_type)?.name||'Technical Support').addFields({name:'Owner',value:`<@${row.user}>`,inline:true},{name:'Assigned to',value:row.claimed?`<@${row.claimed}>`:'Not assigned yet',inline:true},{name:'Topic',value:detail.topic||'Describe your request in this channel.',inline:false},{name:'Status',value:label,inline:false}).setImage('attachment://ticket-progress.png').setFooter({text:'VEX • Private support'})],files:[new AttachmentBuilder(asset('progress-'+stage+'.png'),{name:'ticket-progress.png'})],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('vex:ticket:claim').setLabel('Claim').setEmoji('👤').setStyle(ButtonStyle.Secondary).setDisabled(closed||!!row.claimed),new ButtonBuilder().setCustomId('vex:ticket:transfer').setLabel('Transfer').setEmoji('🔁').setStyle(ButtonStyle.Secondary).setDisabled(closed),new ButtonBuilder().setCustomId('vex:ticket:'+(closed?'reopen':'close')).setLabel(closed?'Reopen':'Close').setEmoji(closed?'🔓':'🔒').setStyle(ButtonStyle.Secondary))],allowedMentions:noMentions};
}
const rowFor=i=>{const r=db.prepare('SELECT * FROM community_tickets WHERE channel=? AND guild=?').get(i.channelId,i.guildId);if(!r)throw Error('This is not a VEX ticket');return r;};
const isStaff=(m,config)=>m.permissions.has(P.ManageChannels)||m.roles.cache.has(config.supportRoleId);
async function freshMember(i){return i.guild.members.fetch({user:i.user.id,force:true});}
async function checkOpen(i){const config=cfg(i.guildId);if(!config.enabled)throw Error('Tickets are disabled');if(!config.categoryId||!config.supportRoleId)throw Error('Finish the ticket setup in the dashboard first');if(!i.guild.roles.cache.has(config.supportRoleId)||config.supportRoleId===i.guildId)throw Error('The support role is unavailable');const category=i.guild.channels.cache.get(config.categoryId);if(!category||category.type!==ChannelType.GuildCategory)throw Error('The ticket category is unavailable');const me=i.guild.members.me;if(!me?.permissions.has(P.ManageChannels))throw Error('VEX needs Manage Channels to create tickets');if(category.permissionsFor&&!category.permissionsFor(me)?.has([P.ViewChannel,P.ManageChannels]))throw Error('VEX cannot create tickets in this category');const {commandAccess}=await import('./command-policy.js');const actor=await freshMember(i),denied=commandAccess(i.guildId,'ticket',actor,i.channel);if(denied)throw Error(denied);return config;}
function requestModal(type){return new ModalBuilder().setCustomId('vex:ticket:request:'+type).setTitle(topic(type).name).addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('subject').setLabel('What do you need help with?').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('details').setLabel('Tell us more').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1800)));}
function detailsFor(row){let d=db.prepare('SELECT * FROM ticket_details WHERE channel=? AND guild=?').get(row.channel,row.guild);if(!d){d={channel:row.channel,guild:row.guild,number:number(row.guild),topic_type:'technical',topic:'Describe your request in this channel.',card_message:''};db.prepare('INSERT INTO ticket_details VALUES(?,?,?,?,?,?)').run(d.channel,d.guild,d.number,d.topic_type,d.topic,d.card_message);}return d;}
async function updateCard(channel,row,detail,source){
 let message;if(detail.card_message&&channel.messages?.fetch){try{message=await channel.messages.fetch(detail.card_message);}catch(e){if(e.code!==10008)throw e;}}
 if(!message&&source?.author?.id===channel.guild?.members.me?.id&&!source.flags?.has(64)&&source.components?.some(r=>r.components.some(c=>['vex:ticket:claim','vex:ticket:close','vex:ticket:reopen'].includes(c.customId))))message=source;
 const payload=ticketCard(row,detail);
 if(message?.edit){await message.edit({...payload,attachments:[]});if(detail.card_message!==message.id)db.prepare('UPDATE ticket_details SET card_message=? WHERE channel=?').run(message.id,row.channel);}
 else {const sent=await channel.send(payload);db.prepare('UPDATE ticket_details SET card_message=? WHERE channel=?').run(sent.id||'',row.channel);}
}
async function createTicket(i,type,subject,body){return exclusive(i.guildId+':'+i.user.id,async()=>{
 const config=await checkOpen(i);const existing=db.prepare("SELECT * FROM community_tickets WHERE guild=? AND user=? AND status='open'").get(i.guildId,i.user.id);
 if(existing){let channel=i.guild.channels.cache.get(existing.channel);if(!channel&&i.guild.channels.fetch)try{channel=await i.guild.channels.fetch(existing.channel);}catch(e){if(e.code!==10003)throw e;}if(channel)return reply('Your ticket is ready',`You already have an open ticket: <#${existing.channel}>`);db.prepare("UPDATE community_tickets SET status='closed' WHERE channel=?").run(existing.channel);}
 const n=number(i.guildId),name='ticket-'+String(n).padStart(4,'0');
 const channel=await i.guild.channels.create({name,type:ChannelType.GuildText,parent:config.categoryId,permissionOverwrites:[{id:i.guildId,deny:[P.ViewChannel]},{id:i.user.id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory]},{id:config.supportRoleId,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory]},{id:i.guild.members.me.id,allow:[P.ViewChannel,P.SendMessages,P.EmbedLinks,P.AttachFiles,P.ManageChannels,P.ReadMessageHistory]}],reason:'VEX private ticket requested by '+i.user.id});
 const row={channel:channel.id,guild:i.guildId,user:i.user.id,status:'open',claimed:'',created:Date.now()},detail={number:n,topic_type:type,topic:subject};
 try{
  const sent=await channel.send(ticketCard(row,detail));
  await channel.send(reply('Request details',body));
  db.transaction(()=>{db.prepare('INSERT INTO community_tickets(channel,guild,user,status,claimed,created) VALUES(?,?,?,?,?,?)').run(row.channel,row.guild,row.user,row.status,row.claimed,row.created);db.prepare('INSERT INTO ticket_details VALUES(?,?,?,?,?,?)').run(row.channel,row.guild,n,type,subject,sent.id||'');})();
 }catch(e){if(channel.delete)await channel.delete('VEX ticket setup did not complete').catch(()=>{});throw e;}
 event(i.guildId,'ticket_opened',{actor:i.user.id,channel:channel.id,number:n,type});return reply('Ticket opened',`Your conversation is ready: <#${channel.id}>`);
 });}
async function action(i,verb,targetId){const initial=rowFor(i);return exclusive(i.guildId+':'+initial.user,async()=>{
 if(['transfer','assign'].includes(verb))requireFeature(i.guildId,'ticketTransfer');
 const row=rowFor(i),config=cfg(i.guildId),actor=await freshMember(i),staff=isStaff(actor,config),detail=detailsFor(row);
 if(!staff&&(verb!=='close'||row.user!==actor.id))throw Error('Ticket staff permission required');
 if(['claim','transfer','assign'].includes(verb)&&row.status!=='open')throw Error('Reopen this ticket before assigning it');
 if(verb==='transfer')return {...reply('Transfer ticket','Choose a member of the support team.'),components:[new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('vex:ticket:assign:'+row.channel).setPlaceholder('Select a support team member').setMaxValues(1))]};
 if(verb==='claim'){if(row.claimed&&row.claimed!==actor.id)throw Error('This ticket is already assigned. Use Transfer to hand it over.');db.prepare('UPDATE community_tickets SET claimed=? WHERE channel=?').run(actor.id,row.channel);event(i.guildId,'ticket_claimed',{actor:actor.id,channel:row.channel});}
 else if(verb==='assign'){const member=await i.guild.members.fetch({user:targetId,force:true});if(member.user?.bot||!isStaff(member,config)||(i.channel.permissionsFor&&!i.channel.permissionsFor(member)?.has(P.ViewChannel)))throw Error('Choose a current member of the support team');db.prepare('UPDATE community_tickets SET claimed=? WHERE channel=?').run(member.id,row.channel);event(i.guildId,'ticket_transferred',{actor:actor.id,assigned:member.id,channel:row.channel});}
 else if(verb==='close'||verb==='reopen'){
  const status=verb==='close'?'closed':'open';if(status==='open'&&db.prepare("SELECT channel FROM community_tickets WHERE guild=? AND user=? AND status='open' AND channel<>?").get(i.guildId,row.user,row.channel))throw Error('This member already has another open ticket');
  await i.channel.permissionOverwrites.edit(row.user,{SendMessages:status==='open'});db.prepare('UPDATE community_tickets SET status=? WHERE channel=?').run(status,row.channel);event(i.guildId,'ticket_'+status,{actor:actor.id,channel:row.channel});
 }else throw Error('Invalid ticket action');
 const current=rowFor(i);await updateCard(i.channel,current,detail,i.message);
 return reply('Ticket updated',verb==='claim'?`Assigned to <@${actor.id}>`:verb==='assign'?`Transferred to <@${targetId}>`:verb==='close'?'The ticket is closed. Your conversation is preserved.':'The ticket is open again.');
 });}
export async function handleTicketInteraction(i){
 if(!i.guild)return false;
 const ticketCommand=i.isChatInputCommand?.()&&i.commandName==='ticket';
 if(!ticketCommand&&!i.customId?.startsWith('vex:ticket:'))return false;
 try{
  if(ticketCommand){await deferPrivate(i);await checkOpen(i);await respondPrivate(i,ticketPanel(cfg(i.guildId)));return true;}
  if(i.isStringSelectMenu?.()&&i.customId==='vex:ticket:topic'||i.isButton?.()&&i.customId==='vex:ticket:open'){
   const type=i.values?.[0]||'technical';if(!topic(type))throw Error('Select a current support topic');await checkOpen(i);await i.showModal(requestModal(type));return true;
  }
  await deferPrivate(i);
  if(i.isModalSubmit?.()&&i.customId.startsWith('vex:ticket:request:')){
   const type=i.customId.split(':')[3];if(!topic(type))throw Error('Invalid support topic');const subject=i.fields.getTextInputValue('subject').trim(),body=i.fields.getTextInputValue('details').trim();if(!subject||subject.length>200||!body||body.length>1800)throw Error('Complete the subject and request details');await i.editReply(await createTicket(i,type,subject,body));
  }else if(i.isUserSelectMenu?.()&&i.customId.startsWith('vex:ticket:assign:')){if(i.customId.split(':')[3]!==i.channelId||i.values.length!==1)throw Error('This transfer menu belongs to another ticket');await i.editReply(await action(i,'assign',i.values[0]));}
  else if(i.isButton?.())await i.editReply(await action(i,i.customId.split(':')[2]));
  else throw Error('This ticket control is outdated');
 }catch(e){const payload=reply('Ticket action failed',String(e.message||'Please try again.').slice(0,1800));if(i.deferred||i.replied)await i.editReply(payload);else await respondPrivate(i,{...payload,flags:64});}
 return true;
}
export async function autoAssignTicket(g,channelId,staffId,ownerId){
 if(ownerId!==g.ownerId)throw Error('Current server owner approval required');
 requireFeature(g.id,'advancedAutomations');const channel=g.channels.cache.get(channelId);if(!channel)throw Error('Ticket channel unavailable');
 return action({guild:g,guildId:g.id,channelId,channel,user:{id:ownerId}},'assign',staffId);
}
export async function publishConfiguredTicketPanel(g){
 const config=cfg(g.id);if(!config.enabled)throw Error('Enable and save this module first');
 const channel=g.channels.cache.get(config.channelId);if(!channel||![0,5].includes(channel.type))throw Error('Choose a text channel in this server');
 return publishTicketPanel(g,channel);
}
export async function publishTicketPanel(g,channel){
 if(!channel.permissionsFor(g.members.me)?.has([P.ViewChannel,P.SendMessages,P.EmbedLinks,P.AttachFiles]))throw Error('VEX needs View Channel, Send Messages, Embed Links and Attach Files in the panel channel');
 const saved=getState(g.id,'ticket_support_panel');let message;
 if(saved?.channel===channel.id&&saved.message&&channel.messages?.fetch)try{message=await channel.messages.fetch(saved.message);}catch(e){if(e.code!==10008)throw e;}
 if(message?.author?.id===g.members.me.id)await message.edit({...ticketPanel(cfg(g.id)),attachments:[]});else message=await channel.send(ticketPanel(cfg(g.id)));
 let privacy;if(saved?.channel===channel.id&&saved.privacy&&channel.messages?.fetch)try{privacy=await channel.messages.fetch(saved.privacy);}catch(e){if(e.code!==10008)throw e;}
 const privacyPayload={content:'🔒 **Your request stays private.**\nWe will create a ticket and keep your conversation between you and our support team.',allowedMentions:noMentions};
 if(privacy?.author?.id===g.members.me.id)await privacy.edit(privacyPayload);else privacy=await channel.send(privacyPayload);
 setState(g.id,'ticket_support_panel',{channel:channel.id,message:message.id,privacy:privacy.id});event(g.id,'panel_published',{kind:'tickets',channel:channel.id,message:message.id});return {url:message.url};
}
const attachedClients=new WeakSet();
export function attachTicketRefresh(client){if(attachedClients.has(client))return;attachedClients.add(client);client.once(Events.ClientReady,async()=>{
 let panels=0,cards=0;
 for(const g of client.guilds.cache.values()){
  try{
   if(!cfg(g.id).enabled)continue;
   let saved=getState(g.id,'ticket_support_panel');
   if(!saved){const old=events(g.id,1000).find(e=>e.kind==='panel_published'&&e.detail.kind==='tickets'&&e.detail.channel===cfg(g.id).channelId);if(old){saved={channel:old.detail.channel,message:old.detail.message};setState(g.id,'ticket_support_panel',saved);}}
   const channel=saved&&g.channels.cache.get(saved.channel);
   if(channel&&channel.id===cfg(g.id).channelId){await publishTicketPanel(g,channel);panels++;}
   for(const row of db.prepare("SELECT * FROM community_tickets WHERE guild=? AND status='open' ORDER BY created DESC LIMIT 100").all(g.id)){
    const ch=g.channels.cache.get(row.channel);if(!ch)continue;
    const detail=detailsFor(row);let source;
    if(!detail.card_message&&ch.messages?.fetch){const messages=await ch.messages.fetch({limit:50});source=messages.find(m=>m.author.id===g.members.me.id&&m.components.some(r=>r.components.some(c=>c.customId?.startsWith('vex:ticket:'))));}
    await updateCard(ch,row,detail,source);cards++;
   }
  }catch(e){console.warn('VEX ticket refresh failed:',g.id,e.code||e.name);}
 }
 console.log(`VEX Ticket Journey ready: ${panels} existing panels and ${cards} active cards refreshed.`);
 });}

const ticketRouters=new WeakSet();
export function attachTicketInteractions(client){
 if(ticketRouters.has(client))return;ticketRouters.add(client);
 const handles=i=>!!i.guild&&(i.customId?.startsWith('vex:ticket:')||(i.isChatInputCommand?.()&&i.commandName==='ticket'));
 // Runtime-installed bot handlers can contain a legacy ticket dispatcher.
 // Leave all other interactions with their original listeners.
 for(const listener of client.listeners(Events.InteractionCreate)){
  client.removeListener(Events.InteractionCreate,listener);
  client.on(Events.InteractionCreate,function(i){if(!handles(i))return listener.call(this,i);});
 }
 client.on(Events.InteractionCreate,i=>{if(handles(i))void handleTicketInteraction(i).catch(e=>console.warn('VEX ticket interaction failed:',e.code||e.name));});
 console.log('VEX Ticket Journey interaction router installed.');
}
