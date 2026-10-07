import crypto from 'node:crypto';
import {EmbedBuilder,ActionRowBuilder as Row,ButtonBuilder as Button,ButtonStyle as Style,escapeMarkdown} from 'discord.js';
import {extraReviewCommands,profileFor} from './command-profiles.js';
import {extraInteraction} from './extra-commands.js';
import {commands} from './commands.js';
import {commandAccess} from './command-policy.js';
import {deferPrivate} from './interaction-response.js';
import {rank} from './community-store.js';
const reviews=new Map();
export function pruneCommandReviews(now=Date.now()){for(const [id,s] of reviews)if(s.expires<=now)reviews.delete(id);}
export function reviewFor(id,i,now=Date.now()){
 const s=reviews.get(id);if(!s||s.expires<=now){reviews.delete(id);throw Error('This review expired. Run the command again.');}
 if(s.owner!==i.user.id||s.guild!==i.guildId||s.channel!==i.channelId)throw Error('This review belongs to another member, server or channel.');return s;
}
async function authorized(i,name){
 const actor=await i.guild.members.fetch({user:i.user.id,force:true}),command=commands.find(c=>c.name===name),denied=commandAccess(i.guildId,name,actor,i.channel);
 if(!command||denied)throw Error(denied||'This command is unavailable.');
 if(command.default_member_permissions&&!actor.permissions.has(BigInt(command.default_member_permissions)))throw Error('Your current Discord permissions do not allow this command.');return actor;
}
const safe=v=>escapeMarkdown(String(v)).slice(0,400);
export function reviewPayload(i,s){
 const p=profileFor(s.command),options=s.options,member=options.getUser?.('member'),role=options.getRole?.('role'),destination=options.getChannel?.('channel');
 const fields=[{name:'CHANNEL',value:`<#${s.channel}>`,inline:true},{name:'REQUESTED BY',value:`<@${s.owner}>`,inline:true}];
 if(member)fields.unshift({name:'MEMBER',value:`<@${member.id}>`,inline:true});
 if(role)fields.push({name:'ROLE',value:`<@&${role.id}>`,inline:true});
 if(destination)fields.push({name:'DESTINATION',value:`<#${destination.id}>`,inline:true});
 if(s.command==='role')fields.push({name:'OPERATION',value:options.getString('action',true).toUpperCase()});
 if(['setxp','setlevel','resetxp'].includes(s.command)){
  const previous=rank(s.guild,member.id),xp=s.command==='setxp'?options.getInteger('amount',true):s.command==='setlevel'?100*options.getInteger('level',true)**2:0;
  fields.push({name:'BEFORE → REQUESTED',value:`${previous.xp} XP · Level ${previous.level}\n→ **${xp} XP · Level ${Math.floor(Math.sqrt(xp/100))}**`});
 }
 if(s.command==='slowmode')fields.push({name:'CURRENT → REQUESTED COOLDOWN',value:`${i.channel.rateLimitPerUser||0}s → **${options.getInteger('seconds',true)}s**`});
 if(s.command==='setnick')fields.push({name:'REQUESTED NICKNAME',value:safe(options.getString('nickname')||'Reset to default name')});
 if(s.command==='warn_remove')fields.push({name:'WARNING TO RETRACT',value:'#'+options.getInteger('case',true)});
 fields.push({name:'EFFECT',value:p.tip});
 const id=verb=>`vex:review:${s.id}:${verb}`;
 const row=new Row().addComponents(new Button().setCustomId(id('confirm')).setLabel(i.vexLocale==='ckb'?'پشتڕاستکردنەوە':'Confirm '+p.label.slice(0,40)).setStyle(['resetxp','vkick','lock'].includes(s.command)?Style.Danger:Style.Primary),new Button().setCustomId(id('cancel')).setLabel(i.vexLocale==='ckb'?'هەڵوەشاندنەوە':'Cancel').setStyle(Style.Secondary));
 return {embeds:[new EmbedBuilder().setTitle(p.icon+' Review · /'+s.command).setDescription('**No changes have been made.**\nReview these details before confirming. Current permissions and command rules will be checked again.\nExpires <t:'+Math.floor(s.expires/1000)+':R>.').setColor(p.color).addFields(fields)],components:[row],allowedMentions:{parse:[]}};
}
export async function executeReview(i,s,execute=extraInteraction){
 if(s.state!=='review')throw Error('This action was already handled.');s.state='executing';
 try{
  await authorized(i,s.command);i.vexCommandName=s.command;
  const adapter=Object.create(i);Object.defineProperties(adapter,{commandName:{value:s.command},options:{value:s.options},isChatInputCommand:{value:()=>true},isButton:{value:()=>false}});
  await execute(adapter);s.state='completed';
 }catch(e){s.state='failed';throw e;}
}
export const handlesReview=i=>!!i.guild&&(i.isChatInputCommand?.()&&extraReviewCommands.has(i.commandName)||i.customId?.startsWith('vex:review:'));
export async function reviewInteraction(i){
 if(!handlesReview(i))return false;
 try{
  if(i.isChatInputCommand?.()){
   await deferPrivate(i);await authorized(i,i.commandName);pruneCommandReviews();if(reviews.size>=2000)throw Error('Please try again shortly.');
   const s={id:crypto.randomBytes(12).toString('hex'),command:i.commandName,options:i.options,owner:i.user.id,guild:i.guildId,channel:i.channelId,expires:Date.now()+120000,state:'review'};reviews.set(s.id,s);
   await i.editReply(reviewPayload(i,s));return true;
  }
  const [, ,id,verb]=i.customId.split(':');const s=reviewFor(id,i);i.vexCommandName=s.command;
  if(!i.deferred&&!i.replied)await i.deferUpdate();
  if(verb==='cancel'){if(s.state!=='review')throw Error('This action was already handled.');s.state='cancelled';await i.editReply({content:'Review cancelled. No changes were made.',embeds:[],components:[],allowedMentions:{parse:[]}});}
  else if(verb==='confirm')await executeReview(i,s);
  else throw Error('This review control is outdated.');
 }catch(e){const payload={content:String(e.message||'This action is unavailable.'),embeds:[],components:[],allowedMentions:{parse:[]}};if(i.deferred||i.replied)await i.editReply(payload).catch(()=>{});else await i.reply({...payload,flags:64}).catch(()=>{});}
 return true;
}
