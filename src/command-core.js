import {localeFor} from './product-localization.js';
import crypto from 'node:crypto';
import {
  ActionRowBuilder as Row, ButtonBuilder as Button, ButtonStyle as Style,
  StringSelectMenuBuilder as Select, UserSelectMenuBuilder as UserSelect,
  ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder,
  PermissionFlagsBits as P, escapeMarkdown
} from 'discord.js';
import {settings, plan, events, db, getState} from './db.js';
import {community, moderate, memberCard} from './community.js';
import {rank, leaderboard, cases} from './community-store.js';
import {commands} from './commands.js';
import {commandAccess} from './command-policy.js';
import {modules, entitled} from './catalog.js';
import {scan,lockdown} from './operations.js';
import {env} from './config.js';
import {deferPrivate} from './interaction-response.js';

export {vexCommand as coreCommand} from './command-spec.js';
const labels={
 en:['Command core','Community','Security','Moderation','Server logs','Support','Voice','AI','Cinema & games','Home','Refresh','Dashboard','Review action','Confirm','Cancel','Choose a section','Choose a member','Choose an action','Reason','Timeout minutes','Review before continuing','Action completed','Action unavailable','View case','Start a moderation action','Welcome preview','My rank','Leaderboard','Run scanner'],
 ckb:['ناوەندی VEX','کۆمەڵگا','پاراستن','بەڕێوەبردن','لۆگەکانی سێرڤەر','پشتیوانی','دەنگ','زیرەکی دەستکرد','سینەما و یاری','سەرەتا','نوێکردنەوە','داشبۆرد','پێداچوونەوەی کردار','پشتڕاستکردنەوە','هەڵوەشاندنەوە','بەشێک هەڵبژێرە','ئەندامێک هەڵبژێرە','کردارێک هەڵبژێرە','هۆکار','ماوەی تایمئاوت بە خولەک','پێش بەردەوامبوون پێداچوونەوە بکە','کردارەکە تەواو بوو','کردارەکە بەردەست نییە','بینینی کەیس','دەستپێکردنی کردار','پێشبینینی وێڵکەم','ڕەنکی من','ڕیزبەندی','پشکنینی سێرڤەر'],
 ar:['مركز VEX','المجتمع','الحماية','الإشراف','سجلات الخادم','الدعم','الصوت','الذكاء الاصطناعي','السينما والألعاب','الرئيسية','تحديث','لوحة التحكم','مراجعة الإجراء','تأكيد','إلغاء','اختر قسماً','اختر عضواً','اختر إجراءً','السبب','مدة التقييد بالدقائق','راجع قبل المتابعة','اكتمل الإجراء','الإجراء غير متاح','عرض الحالة','بدء إجراء إشراف','معاينة الترحيب','رتبتي','الترتيب','فحص الخادم'],
 tr:['VEX merkezi','Topluluk','Güvenlik','Moderasyon','Sunucu kayıtları','Destek','Ses','Yapay zekâ','Sinema ve oyunlar','Ana sayfa','Yenile','Kontrol paneli','İşlemi incele','Onayla','İptal','Bir bölüm seç','Bir üye seç','Bir işlem seç','Sebep','Zaman aşımı dakika','Devam etmeden önce incele','İşlem tamamlandı','İşlem kullanılamıyor','Vakayı görüntüle','Moderasyon işlemi başlat','Karşılama önizlemesi','Sıralamam','Lider tablosu','Sunucuyu tara']
};
const sections=['home','community','security','moderation','logs','support','voice','ai','games'];
const sectionsIndex={home:0,community:1,security:2,moderation:3,logs:4,support:5,voice:6,ai:7,games:8};
const colors={home:0x9275ff,community:0x60d5b1,security:0x64b4ef,moderation:0xf2b96b,logs:0xa6b4d2,support:0x9275ff,voice:0x64b4ef,ai:0xc38cf7,games:0xf2b96b};
const actionPermissions={warn:P.ModerateMembers,timeout:P.ModerateMembers,untimeout:P.ModerateMembers,kick:P.KickMembers,ban:P.BanMembers,unban:P.BanMembers,clear:P.ManageMessages};
export const reviewCommands=new Set(Object.keys(actionPermissions));
export const coreCommands=new Set(['vex','help','commands','security','scan','lockdown','moderate',...reviewCommands]);
const sessions=new Map();
export function pruneSessions(now=Date.now()) { for(const [id,s] of sessions) if(s.expires<=now) sessions.delete(id); }
const lang=localeFor;
const word=(locale,n)=>(labels[locale]||labels.en)[n];
const safe=(v,max=700)=>escapeMarkdown(String(v??'—')).slice(0,max);
const cid=(owner,locale,verb,arg='')=>`vex:core:${owner}:${locale}:${verb}:${arg}`;
const button=(owner,locale,verb,label,arg='',style=Style.Secondary)=>new Button().setCustomId(cid(owner,locale,verb,arg)).setLabel(label).setStyle(style);
const dashboard=(locale,section='home')=>new Button().setLabel(word(locale,11)).setStyle(Style.Link).setURL(env.publicUrl+'/?section='+encodeURIComponent(({home:'overview',security:'protection',moderation:'community:moderation',logs:'serverlogs',support:'community:tickets',voice:'community:tempvoice',ai:'ai-chat',games:'community:cinema'})[section]||'community'));
export function coreCard(g,title,description,{locale='en',section='home',fields=[],components=[]}={}) {
 const embed=new EmbedBuilder().setColor(colors[section]||colors.home)
  .setAuthor({name:`VEX // ${section.toUpperCase()} CORE`}).setTitle(String(title).slice(0,256))
  .setDescription(String(description||' ').slice(0,3800)).setFooter({text:'VEX • PRIVATE CONTROL SESSION'}).setTimestamp();
 if(fields.length)embed.addFields(fields.map(f=>({...f,name:String(f.name).slice(0,256),value:String(f.value||'—').slice(0,1024)})));
 return {content:null,embeds:[embed],components,allowedMentions:{parse:[]}};
}
const canCommand=(g,actor,ch,name)=>{
 const command=commands.find(c=>c.name===name);
 return !!command&&!commandAccess(g.id,name,actor,ch)&&(!command.default_member_permissions||actor.permissions.has(BigInt(command.default_member_permissions)));
};
const visibleSection=(section,actor)=>!['security','logs'].includes(section)||actor.permissions.has(P.ManageGuild);
const navigation=(g,actor,ch,owner,locale,section)=>[
 new Row().addComponents(new Select().setCustomId(cid(owner,locale,'nav')).setPlaceholder(word(locale,15))
  .addOptions(sections.filter(s=>visibleSection(s,actor)).map(s=>({label:word(locale,sectionsIndex[s]),value:s,default:s===section})))),
 new Row().addComponents(button(owner,locale,'nav',word(locale,9),'home'),button(owner,locale,'nav',word(locale,10),section),dashboard(locale,section))
];
const groupNames={community:['welcome','rank','leaderboard','top','roles','colors','color','invite','starboard'],moderation:['warn','timeout','untimeout','kick','ban','unban','clear','warnings','warn_remove','cases','lock','unlock','slowmode','role','setnick','setxp','setlevel','resetxp'],security:['verify','scan','lockdown','security'],voice:['room','moveme','move','vkick'],support:['ticket']};
function matchingCommands(section){
 if(section==='ai')return commands.filter(c=>/^(ai|chat|ask)|ai security/i.test(c.name+' '+c.description));
 if(section==='games')return commands.filter(c=>/cinema|blackout|game|watch|activity|play/i.test(c.name+' '+c.description));
 return commands.filter(c=>(groupNames[section]||[]).includes(c.name));
}
export function buildCorePage(i,actor,section='home',locale=lang(i)) {
 const g=i.guild,owner=i.user.id,c=community(g.id),s=settings(g.id);
 if(!sections.includes(section))throw Error('Unknown section');
 if(!visibleSection(section,actor))throw Error('Manage Server permission required');
 let title=word(locale,sectionsIndex[section]),description='',fields=[],extra=[];
 if(section==='home') {
  description=`**${safe(actor.displayName||i.user.username,80)}** · **${safe(g.name,150)}**\nSelect a section. Your controls stay in this private message.`;
  fields=[{name:'CONNECTION',value:i.client?.isReady?.()?'● Online':'○ Reconnecting',inline:true},
   {name:'MEMBERS',value:String(g.memberCount??'—'),inline:true},{name:'ACCESS',value:plan(g.id).toUpperCase(),inline:true},
   {name:'MODULES',value:`${Object.values(c).filter(v=>v.enabled).length} community modules enabled\n${Object.values(s.modules).filter(v=>v.enabled).length} configured protections`,inline:true}];
 }else if(section==='security') {
  const active=modules.filter(m=>s.modules[m.id]?.enabled&&entitled(plan(g.id),m.id));
  description='Protection status reflects saved settings and current plan access. Review each module in the dashboard.';
  fields=[{name:'ACTIVE PROTECTIONS',value:active.map(m=>'● '+m.name).join('\n')||'No entitled protection modules enabled.'},{name:'SERVER ACCESS',value:plan(g.id).toUpperCase(),inline:true}];
  if(canCommand(g,actor,i.channel,'scan')&&entitled(plan(g.id),'scanner'))extra.push(button(owner,locale,'scan',word(locale,28)));
 }else if(section==='community') {
  description='Welcomes, departures, invites, ranks and roles belong together.';
  fields=[{name:'WELCOME / LEAVE',value:`Welcome: ${c.welcome.enabled?'ON':'OFF'} · Leave: ${c.goodbye.enabled?'ON':'OFF'}`,inline:true},{name:'LEVELING / ROLES',value:`Leveling: ${c.levels.enabled?'ON':'OFF'} · Roles: ${c.selfroles.enabled?'ON':'OFF'}`,inline:true}];
  if(canCommand(g,actor,i.channel,'rank')&&c.levels.enabled)extra.push(button(owner,locale,'rank',word(locale,26)));
  if(canCommand(g,actor,i.channel,'leaderboard')&&c.levels.enabled)extra.push(button(owner,locale,'top',word(locale,27)));
  if(canCommand(g,actor,i.channel,'welcome')&&actor.permissions.has(P.ManageGuild))extra.push(button(owner,locale,'welcome',word(locale,25)));
 }else if(section==='moderation') {
  description=`Moderation: **${c.moderation.enabled?'ON':'OFF'}**. Select a member, set the action and reason, review, then confirm. Permissions are checked again at confirmation.`;
  const available=['warn','timeout','untimeout','kick','ban'].some(a=>canCommand(g,actor,i.channel,a));
  if(available&&c.moderation.enabled)extra.push(button(owner,locale,'start',word(locale,24),'',Style.Primary));
  if(canCommand(g,actor,i.channel,'cases'))extra.push(button(owner,locale,'cases',word(locale,23)));
 }else if(section==='logs') {
  description='Recent events recorded by VEX. Actor and target are shown only when the event supplied them.';
  fields=events(g.id,5).map(e=>({name:`#${e.id} · ${safe(e.kind,100)}`,value:`Actor: ${e.detail.actor?'<@'+e.detail.actor+'>':'Not recorded'}\nTarget: ${e.detail.target||e.detail.member||e.detail.author?'<@'+(e.detail.target||e.detail.member||e.detail.author)+'>':'Not recorded'}\n<t:${Math.floor(e.at/1000)}:R>`}));
  if(!fields.length)description+='\nNo events recorded yet.';
 }else if(section==='support')description=`Support: **${c.tickets.enabled?'ON':'OFF'}**. Use **/ticket** to choose a topic and open a private request. Existing tickets remain available to the requester and staff.`;
 else if(section==='voice')description=`Personal rooms: **${c.tempvoice.enabled?'ON':'OFF'}**. Join the configured lobby to create your room, then use /room to manage it.`;
 else if(section==='ai')description='The commands below come from this running VEX installation. Provider connectivity and quotas are controlled by the AI module.';
 else if(section==='games')description='Cinema and game commands available in this installation appear below. Use their registered command to launch the existing experience.';
 if(section!=='home'&&section!=='logs'){
  const list=matchingCommands(section).filter(cmd=>canCommand(g,actor,i.channel,cmd.name));
  fields.push({name:'AVAILABLE COMMANDS',value:list.map(c=>'`/'+c.name+'`').join(' · ')||'No commands available to your roles here.'});
 }
 const components=navigation(g,actor,i.channel,owner,locale,section);
 if(extra.length)components.splice(1,0,new Row().addComponents(extra));
 return coreCard(g,title,description,{locale,section,fields,components});
}
function createSession(i,values,locale=lang(i)) {
 pruneSessions();if(sessions.size>=2000)throw Error('VEX is busy. Please try again shortly.');
 const id=crypto.randomBytes(12).toString('hex');
 const s={id,guild:i.guildId,owner:i.user.id,channel:i.channelId,locale,expires:Date.now()+120000,state:'draft',...values};sessions.set(id,s);return s;
}
export function sessionFor(id,i,now=Date.now()) {
 const s=sessions.get(id);
 if(!s||s.expires<=now){sessions.delete(id);throw Error('This review expired. Run the command again.');}
 if(s.guild!==i.guildId||s.owner!==i.user.id||s.channel!==i.channelId)throw Error('This control belongs to another session.');
 return s;
}
async function freshActor(i){return i.guild.members.fetch({user:i.user.id,force:true});}
function assertAccess(i,actor,name) {
 if(!canCommand(i.guild,actor,i.channel,name))throw Error('This command is disabled here, or your current Discord permissions do not allow it.');
}
export async function preflight(i,actor,s) {
 assertAccess(i,actor,s.policy||s.action);
 if(s.policy==='moderate')assertAccess(i,actor,s.action);
 if(s.action==='lockdown'){if(actor.id!==i.guild.ownerId)throw Error('Server owner required');if(s.enabled&&!entitled(plan(i.guildId),'lockdown'))throw Error('Ultimate access required');if(s.enabled&&!settings(i.guildId).lockdownChannels.length)throw Error('Configure lockdown channels in the dashboard first');return;}
 if(!community(i.guildId).moderation.enabled)throw Error('Moderation is disabled in the dashboard.');
 const permission=actionPermissions[s.action];if(!permission||!actor.permissions.has(permission))throw Error('Missing moderation permission');
 const bot=i.guild.members.me;if(!bot||s.action!=='warn'&&!bot.permissions.has(permission))throw Error('VEX is missing the required permission');
 if(s.action==='clear') {
  if(![0,5].includes(i.channel?.type)||!i.channel.permissionsFor(actor)?.has(P.ManageMessages)||!i.channel.permissionsFor(bot)?.has(P.ManageMessages))throw Error('Manage Messages is required for you and VEX in this channel');
  if(!Number.isInteger(s.amount)||s.amount<1||s.amount>100)throw Error('Choose 1–100 messages');return;
 }
 if(!/^\d{17,22}$/.test(s.target||''))throw Error('Choose a valid member');
 if(s.action==='unban'){await i.guild.bans.fetch(s.target);return;}
 const target=await i.guild.members.fetch({user:s.target,force:true});
 if(target.id===i.guild.ownerId||target.id===actor.id||target.id===bot.id||actor.id!==i.guild.ownerId&&actor.roles.highest.comparePositionTo(target.roles.highest)<=0)throw Error('Your role cannot moderate this member');
 if(['timeout','untimeout'].includes(s.action)&&!target.moderatable||s.action==='kick'&&!target.kickable||s.action==='ban'&&!target.bannable)throw Error('VEX role hierarchy prevents this action');
 if(s.action==='timeout'&&(!Number.isInteger(s.minutes)||s.minutes<1||s.minutes>40320))throw Error('Choose 1–40320 minutes');
 s.targetName=target.displayName||target.user.username;
}
export function reviewCard(i,s) {
 if(s.action==='lockdown')return coreCard(i.guild,word(s.locale,12),s.enabled?'Pause public messaging in the configured channels. Administrators and explicit permission overrides may bypass this restriction.':'Restore the public messaging permissions saved by VEX.',{section:'security',fields:[{name:'ACTION',value:s.enabled?'ENABLE LOCKDOWN':'RESTORE ACCESS'},{name:'CHANNELS',value:(s.enabled?settings(i.guildId).lockdownChannels:Object.keys(getState(i.guildId,'lockdown',{}))).map(id=>'<#'+id+'>').join(' · ')||'No saved channels'}],components:[new Row().addComponents(button(s.owner,s.locale,'confirm',word(s.locale,13),s.id,Style.Danger),button(s.owner,s.locale,'cancel',word(s.locale,14),s.id))]});
 const fields=[{name:'TARGET',value:s.action==='clear'?`<#${s.channel}>`:`<@${s.target}>${s.targetName?' · '+safe(s.targetName,80):''}`,inline:true},{name:'ACTION',value:s.action.toUpperCase(),inline:true},{name:'MODERATOR',value:`<@${s.owner}>`,inline:true},{name:'REASON',value:safe(s.reason||'No reason supplied',450)}];
 if(s.action==='timeout')fields.push({name:'DURATION',value:s.minutes+' minutes',inline:true});
 if(s.action==='clear')fields.push({name:'MESSAGES',value:String(s.amount),inline:true});
 const limits={ban:'Confirmation bans this member. Reversing a ban does not restore their membership.',kick:'Confirmation removes this member. They must rejoin using an invitation.',clear:'Deleted messages cannot be restored. Messages older than 14 days are skipped.'};
 return coreCard(i.guild,word(s.locale,12),word(s.locale,20)+'.\n'+(limits[s.action]||'The action will be recorded in the server casebook.')+`\nExpires <t:${Math.floor(s.expires/1000)}:R>.`,{locale:s.locale,section:'moderation',fields,components:[new Row().addComponents(button(s.owner,s.locale,'confirm',word(s.locale,13),s.id,Style.Danger),button(s.owner,s.locale,'cancel',word(s.locale,14),s.id))]});
}
export async function confirmAction(i,s,actor) {
 if(s.state!=='review')throw Error('This action was already handled.');
 // Claim synchronously, before any asynchronous authorization or Discord calls.
 s.state='executing';
 try {
  await preflight(i,actor,s);
  if(s.action==='lockdown'){const results=await lockdown(i.guild,s.enabled,actor.id);s.state='completed';return coreCard(i.guild,word(s.locale,21),results.map(r=>'<#'+r.id+'> · '+safe(r.error||r.result,300)).join('\n')||'No channels changed.',{section:'security',components:navigation(i.guild,actor,i.channel,s.owner,s.locale,'security')});}
  const result=await moderate(i.guild,actor,{action:s.action,target:s.target,reason:s.reason,minutes:s.minutes,amount:s.amount,channel:s.channel});
  s.state='completed';s.caseId=Number(result.id);s.expires=Date.now()+600000;
  return coreCard(i.guild,word(s.locale,21),result.result,{locale:s.locale,section:'moderation',fields:[{name:'CASE',value:'#'+result.id,inline:true},{name:'MODERATOR',value:`<@${actor.id}>`,inline:true},{name:'RECORDED',value:`<t:${Math.floor(Date.now()/1000)}:F>`,inline:true}],components:[new Row().addComponents(button(s.owner,s.locale,'case',word(s.locale,23),s.id),button(s.owner,s.locale,'nav',word(s.locale,9),'home'))]});
 }catch(e){s.state='failed';throw e;}
}
function actionModal(s) {
 const modal=new ModalBuilder().setCustomId(cid(s.owner,s.locale,'reason',s.id)).setTitle(word(s.locale,12));
 modal.addComponents(new Row().addComponents(new TextInputBuilder().setCustomId('reason').setLabel(word(s.locale,18)).setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(450)));
 if(s.action==='timeout')modal.addComponents(new Row().addComponents(new TextInputBuilder().setCustomId('minutes').setLabel(word(s.locale,19)).setStyle(TextInputStyle.Short).setRequired(true).setValue('10').setMaxLength(5)));
 return modal;
}
function draftCard(i,s) {
 return coreCard(i.guild,word(s.locale,3),s.target?`<@${s.target}> · ${word(s.locale,17)}`:word(s.locale,16),{locale:s.locale,section:'moderation',components:[new Row().addComponents(s.target?new Select().setCustomId(cid(s.owner,s.locale,'action',s.id)).setPlaceholder(word(s.locale,17)).addOptions(['warn','timeout','untimeout','kick','ban'].filter(a=>s.available.includes(a)).map(a=>({label:a.toUpperCase(),value:a}))):new UserSelect().setCustomId(cid(s.owner,s.locale,'target',s.id)).setPlaceholder(word(s.locale,16)).setMinValues(1).setMaxValues(1)),new Row().addComponents(button(s.owner,s.locale,'cancel',word(s.locale,14),s.id))]});
}
const sameMessage=async i=>{if(!i.deferred&&!i.replied)await i.deferUpdate();};
async function caseCard(i,actor,s) {
 assertAccess(i,actor,'cases');
 const entry=db.prepare('SELECT * FROM mod_cases WHERE guild=? AND id=?').get(i.guildId,s.caseId);
 if(!entry)throw Error('Case not found in this server');
 return coreCard(i.guild,'CASE #'+entry.id,`**${safe(entry.action)}**\n${safe(entry.reason,450)}`,{section:'moderation',fields:[{name:'ACTOR',value:`<@${entry.actor}>`,inline:true},{name:'TARGET',value:`<@${entry.target}>`,inline:true},{name:'TIME',value:`<t:${Math.floor(entry.at/1000)}:F>`}],components:[new Row().addComponents(button(s.owner,s.locale,'nav',word(s.locale,9),'home'))]});
}
export async function coreInteraction(i) {
 if(!i.guild)return false;
 const slash=i.isChatInputCommand?.()&&coreCommands.has(i.commandName);
 if(!slash&&!i.customId?.startsWith('vex:core:'))return false;
 let locale=lang(i);
 try {
  if(slash) {
   await deferPrivate(i);const actor=await freshActor(i);assertAccess(i,actor,i.commandName);
   if(reviewCommands.has(i.commandName)||i.commandName==='moderate') {
    const action=i.commandName==='moderate'?i.options.getString('action',true):i.commandName;
    const s=createSession(i,{action,policy:i.commandName,target:action==='clear'?null:action==='unban'||i.commandName==='moderate'?i.options.getString(action==='unban'&&i.commandName!=='moderate'?'member_id':'member_id'):i.options.getUser('member',true).id,reason:i.options.getString('reason')||'No reason supplied',minutes:i.options.getInteger('minutes')??10,amount:i.options.getInteger('amount')??10});
    s.state='validating';await preflight(i,actor,s);s.state='review';await i.editReply(reviewCard(i,s));return true;
   }
   if(i.commandName==='lockdown'){const s=createSession(i,{action:'lockdown',policy:'lockdown',enabled:i.options.getBoolean('enabled',true)},locale);await preflight(i,actor,s);s.state='review';await i.editReply(reviewCard(i,s));return true;}
   if(i.commandName==='scan'){if(!entitled(plan(i.guildId),'scanner'))throw Error('Ultimate access required');const result=scan(i.guild);await i.editReply(coreCard(i.guild,'CONFIGURATION · '+result.score+'/100',result.checks.map(c=>(c.ok?'✓ ':'⚠ ')+c.name).join('\n')+'\n\n'+result.notice,{section:'security',components:navigation(i.guild,actor,i.channel,i.user.id,locale,'security')}));return true;}
   await i.editReply(buildCorePage(i,actor,i.commandName==='security'?'security':'home',locale));return true;
  }
  const parts=i.customId.split(':'),owner=parts[2];locale=parts[3];const verb=parts[4],arg=parts[5];
  if(owner!==i.user.id){await i.reply({...coreCard(i.guild,'Private control','Open /vex for your own controls.'),flags:64});return true;}
  if(verb==='action') {
   const s=sessionFor(arg,i);if(s.state!=='draft'||!s.target||!s.available.includes(i.values?.[0]))throw Error('This action selection is outdated');s.action=i.values[0];s.policy=s.action;
   // Opening a form has no side effect. Fetch fresh permissions on submit.
   await i.showModal(actionModal(s));return true;
  }
  await sameMessage(i);const actor=await freshActor(i);
  if(verb==='nav'){assertAccess(i,actor,'vex');if((arg||i.values?.[0])==='security')assertAccess(i,actor,'security');await i.editReply(buildCorePage(i,actor,arg||i.values?.[0]||'home',locale));}
  else if(verb==='start') {
   const available=['warn','timeout','untimeout','kick','ban'].filter(a=>canCommand(i.guild,actor,i.channel,a));
   if(!available.length||!community(i.guildId).moderation.enabled)throw Error('No moderation action is available here');
   const s=createSession(i,{available},locale);await i.editReply(draftCard(i,s));
  }else if(verb==='target') {
   const s=sessionFor(arg,i);if(s.state!=='draft'||i.values?.length!==1)throw Error('This member selection is outdated');s.target=i.values[0];await i.editReply(draftCard(i,s));
  }else if(verb==='reason') {
   const s=sessionFor(arg,i);if(s.state!=='draft'||!s.action)throw Error('This form was already submitted');s.reason=i.fields.getTextInputValue('reason').trim();if(!s.reason||s.reason.length>450)throw Error('Supply a reason of 1–450 characters');
   if(s.action==='timeout'){const value=i.fields.getTextInputValue('minutes').trim();if(!/^\d{1,5}$/.test(value))throw Error('Enter a whole number of minutes');s.minutes=Number(value);}
   s.state='validating';await preflight(i,actor,s);s.state='review';await i.editReply(reviewCard(i,s));
  }else if(verb==='confirm'){const s=sessionFor(arg,i);await i.editReply(await confirmAction(i,s,actor));}
  else if(verb==='cancel'){const s=sessionFor(arg,i);if(!['draft','review'].includes(s.state))throw Error('This action was already handled');s.state='cancelled';await i.editReply(buildCorePage(i,actor,'moderation',locale));}
  else if(verb==='case'){await i.editReply(await caseCard(i,actor,sessionFor(arg,i)));}
  else if(verb==='cases') {
   assertAccess(i,actor,'cases');await i.editReply(coreCard(i.guild,word(locale,23),cases(i.guildId).slice(0,6).map(c=>`**#${c.id} · ${safe(c.action,30)}**\nActor <@${c.actor}> · Target <@${c.target}>\n${safe(c.reason,450)}\n<t:${Math.floor(c.at/1000)}:R>`).join('\n\n')||'No cases recorded.',{section:'moderation',components:navigation(i.guild,actor,i.channel,owner,locale,'moderation')}));
  }else if(verb==='scan') {
   assertAccess(i,actor,'scan');if(!entitled(plan(i.guildId),'scanner'))throw Error('Ultimate access required');const r=scan(i.guild);await i.editReply(coreCard(i.guild,'CONFIGURATION · '+r.score+'/100',r.checks.map(c=>(c.ok?'✓ ':'⚠ ')+c.name).join('\n')+'\n\n'+r.notice,{section:'security',components:navigation(i.guild,actor,i.channel,owner,locale,'security')}));
  }else if(verb==='welcome') {
   assertAccess(i,actor,'welcome');const payload=memberCard(i.guild,community(i.guildId).welcome,actor);payload.components=navigation(i.guild,actor,i.channel,owner,locale,'community');payload.allowedMentions={parse:[]};await i.editReply(payload);
  }else if(verb==='rank'||verb==='top') {
   assertAccess(i,actor,verb==='rank'?'rank':'leaderboard');if(!community(i.guildId).levels.enabled)throw Error('Leveling is disabled');const r=rank(i.guildId,i.user.id);
   await i.editReply(coreCard(i.guild,word(locale,verb==='rank'?26:27),verb==='rank'?`<@${i.user.id}> · Level **${r.level}**\n**${r.xp} XP** · Position **#${r.position}**`:leaderboard(i.guildId).slice(0,10).map((r,n)=>`**${n+1}.** <@${r.user}> · Level ${r.level} · ${r.xp} XP`).join('\n')||'No XP recorded.',{section:'community',components:navigation(i.guild,actor,i.channel,owner,locale,'community')}));
  }else throw Error('This control is outdated. Open /vex again.');
 }catch(e) {
  const payload=coreCard(i.guild,word(locale,22),String(e.message||'Please try again.'),{locale,components:[new Row().addComponents(button(i.user.id,locale,'nav',word(locale,9),'home'),dashboard(locale))]});
  if(i.deferred||i.replied)await i.editReply(payload).catch(()=>{});else await i.reply({...payload,flags:64}).catch(()=>{});
 }
 return true;
}
const routers=new WeakSet();
export function attachCommandCore(client) {
 if(routers.has(client))return;routers.add(client);
 const handles=i=>!!i.guild&&((i.isChatInputCommand?.()&&coreCommands.has(i.commandName))||i.customId?.startsWith('vex:core:'));
 for(const listener of client.listeners('interactionCreate')) {
  client.removeListener('interactionCreate',listener);
  client.on('interactionCreate',function(i){if(!handles(i))return listener.call(this,i);});
 }
 client.on('interactionCreate',i=>{if(handles(i))void coreInteraction(i).catch(e=>console.warn('VEX command core failed:',e.code||e.name));});
 client.once('clientReady',()=>{const timer=setTimeout(async()=>{try{let registered=await client.application.commands.fetch();if(!registered.some(c=>c.name==='vex'))registered=await client.application.commands.set(commands);console.log('VEX_COMMAND_CORE_REGISTRATION',JSON.stringify({present:registered.some(c=>c.name==='vex'),count:registered.size,names:registered.map(c=>c.name)}));}catch(e){console.error('VEX command core registration check failed:',e.code||e.name);}},5000);timer.unref();});
 console.log('VEX Command Core 4.0 installed.');
}
