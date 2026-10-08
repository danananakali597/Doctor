import {SlashCommandBuilder,PermissionFlagsBits as P,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle} from 'discord.js';
import {securitySuiteStatus} from './security-suite.js';
import {env} from './config.js';
import {events} from './db.js';
export const securitySuiteCommand=new SlashCommandBuilder().setName('vex-security').setDescription('Open the unified VEX Security control center').setDefaultMemberPermissions(P.ManageGuild).addStringOption(o=>o.setName('view').setDescription('Choose a security view').addChoices({name:'Status',value:'status'},{name:'Settings',value:'settings'},{name:'Incidents',value:'incidents'},{name:'Budget',value:'budget'})).toJSON();
export async function securitySuiteInteraction(i){
 if(!i.isChatInputCommand()||i.commandName!=='vex-security')return false;
 const member=await i.guild.members.fetch({user:i.user.id,force:true});if(!member.permissions.has(P.ManageGuild))throw Error('Manage Server required');
 const s=securitySuiteStatus(i.guildId),view=i.options.getString('view')||'status';
 const embed=new EmbedBuilder().setColor(s.mode==='enforce'?0x60d5b1:s.mode==='monitor'?0xf2b96b:0xee8292).setTitle('VEX · AI Security').setDescription(`Mode: **${s.mode}**\nOpenAI: **${s.configured?'configured':'not configured'}**\nContent AI: **${s.available&&s.aiEnabled?'enabled':'disabled'}**\nPaid review: **${s.paidReview?'enabled':'disabled'}**`);
 if(view==='budget')embed.addFields({name:'This server · UTC month',value:`$${(s.budget.usedMicros/1000000).toFixed(4)} / $${(s.budget.limitMicros/1000000).toFixed(2)}\n${s.budget.dailyReviews} / ${s.budget.dailyLimit} daily paid reviews`});
 if(view==='incidents'){const recent=events(i.guildId,100).filter(e=>/violation|incident|protection|risk/.test(e.kind)).slice(0,5);embed.addFields({name:'Recent incidents',value:recent.map(e=>`**#${e.id} · ${e.kind}**\nActor: ${e.detail.actor||e.detail.target||'unknown'} · ${String(e.detail.result||'review').slice(0,160)}`).join('\n\n')||'No incidents recorded.'});}
 const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Open AI Security').setStyle(ButtonStyle.Link).setURL(env.publicUrl+'/?section=security-center'));
 await i.editReply({embeds:[embed],components:[row],allowedMentions:{parse:[]}});return true;
}
