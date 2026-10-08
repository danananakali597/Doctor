import {securitySuiteInteraction} from './security-suite-commands.js';
import {deferPrivate,respondPrivate} from './interaction-response.js';
import {attachCommunity,communityInteraction} from './community.js';
import {startNotifications} from './notifications.js';
import {Client,GatewayIntentBits as I,Events,Partials,PermissionFlagsBits as P,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle} from 'discord.js';
import {commands} from './commands.js';
import {attachSecurity,verifyMember} from './security.js';
import {attachServerLogs} from './logs.js';
import {scan,lockdown} from './operations.js';
import {plan} from './db.js';
import {entitled,modules} from './catalog.js';
import {env} from './config.js';
import {extraInteraction} from './extra-commands.js';
import {commandAccess} from './command-policy.js';

export const client=new Client({intents:[I.Guilds,I.GuildMembers,I.GuildMessages,I.MessageContent,I.GuildVoiceStates,I.GuildModeration,I.GuildMessageReactions],partials:[Partials.Message,Partials.Channel,Partials.Reaction]});
attachSecurity(client);
attachServerLogs(client);
attachCommunity(client);
const pages={overview:{name:'Control center',color:0x8270f5,description:'Security controls and clear incident records for your community.'},basic:{name:'Basic · Free',color:0x60d5b1,description:'Core protection for messages and members.'},plus:{name:'Plus · $7 / server / month',color:0x64b4ef,description:'Stronger screening and incident visibility.'},ultimate:{name:'Ultimate · $14 / server / month',color:0xc38cf7,description:'Recovery, configuration checks and server safeguards.'}};
const categories={basic:[['Message safety',['spam','links','invites','mentions','words','automod']],['Monitoring',['logs','joins']]],plus:[['Member screening',['raid','verification','age','quarantine','bots']],['Detection & access',['scam','urls','voice','advancedLogs','trust']]],ultimate:[['Server safeguards',['nuke','massModeration','channels','roles','permissions','webhooks','protected','risk']],['Response & insight',['lockdown','scanner','score','reports','timeline','backup','tamper','owner']]]};
export function helpCard(guildId,page='overview'){
 const info=pages[page]||pages.overview,access=plan(guildId),embed=new EmbedBuilder().setColor(info.color).setAuthor({name:'VEX  •  SECURITY CONTROL'}).setTitle(info.name).setDescription(info.description).setFooter({text:`Current access: ${access.toUpperCase()}  •  Manage settings in the dashboard`});
 if(page==='overview')embed.addFields({name:'🟢 Basic · Free',value:'Message filters, AutoMod, logs and join monitoring.',inline:true},{name:'🔵 Plus · $7 / month',value:'Raid detection, screening, trusted users and advanced logs.',inline:true},{name:'🟣 Ultimate · $14 / month',value:'Anti-Nuke, lockdown, scanner and recovery.',inline:true},{name:'Commands',value:'`/commands` · `/help` · `/security` · `/verify member` · `/scan` · `/lockdown enabled`'},{name:'Get started',value:'Choose a level below, then open the dashboard to set up each module.'});
 else for(const [title,ids] of categories[page])embed.addFields({name:title,value:ids.map(id=>`• ${modules.find(m=>m.id===id).name}`).join('\n')});
 if(page!=='basic'&&page!=='overview')embed.addFields({name:'Availability',value:'Monthly prices: Plus $7 / Ultimate $14 per server. Automatic checkout is not connected yet; paid access starts only after confirmed payment.'});
 const row=new ActionRowBuilder().addComponents(...Object.keys(pages).map(key=>new ButtonBuilder().setCustomId('vex:help:'+key).setLabel(key==='overview'?'Overview':key[0].toUpperCase()+key.slice(1)).setStyle(key===page?ButtonStyle.Primary:ButtonStyle.Secondary)));
 const dashboard=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('vex:guide:explore').setLabel('Browse commands').setEmoji('🧭').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setLabel('Open dashboard').setStyle(ButtonStyle.Link).setURL(env.publicUrl));
 return {embeds:[embed],components:[row,dashboard],allowedMentions:{parse:[]}};
}
const notice=(title,description,color=0x8270f5)=>({embeds:[new EmbedBuilder().setColor(color).setTitle(title).setDescription(String(description).slice(0,3900)).setFooter({text:'VEX  •  SECURITY CONTROL'})],allowedMentions:{parse:[]}});
client.once(Events.ClientReady,async c=>{console.log(`VEX ready as ${c.user.tag}`);c.user.setActivity('VEX Community | /commands');startNotifications(c);try{await c.application.fetch();await c.application.commands.set(commands);}catch(e){console.error('Command registration:',e.message);}});
client.on(Events.InteractionCreate,async i=>{
 if(!i.guild)return;
 if(i.isChatInputCommand()){
  /* VEX_EARLY_ACK */ await deferPrivate(i);
  try{const actor=await i.guild.members.fetch({user:i.user.id,force:true});const reason=commandAccess(i.guildId,i.commandName,actor,i.channel);if(reason){await respondPrivate(i,{content:`⚠️ ${reason}`,flags:64});return;}}
  catch(e){console.warn('Command access check failed',e.code||e.message);await respondPrivate(i,{content:'Could not verify command access. Please try again.',flags:64}).catch(()=>{});return;}
 }
 try{if(await securitySuiteInteraction(i))return;}catch(e){await i.editReply({content:e.message,allowedMentions:{parse:[]}}).catch(()=>{});return;}
 try{if(await communityInteraction(i))return;}catch(e){console.warn('Community interaction failed',e.code||e.name);return;}
 try{if(await extraInteraction(i))return;}catch(e){console.warn('Command interaction failed',e.code||e.name);return;}
 if(i.isButton()&&i.customId.startsWith('vex:help:')){const page=i.customId.slice('vex:help:'.length);if(!pages[page])return;try{await i.update(helpCard(i.guildId,page));}catch(e){console.error('Help navigation:',e.message);}return;}
 if(!i.isChatInputCommand())return;
 await deferPrivate(i);
 try{
  const actor=await i.guild.members.fetch({user:i.user.id,force:true});let result;
  if(i.commandName==='help')result=helpCard(i.guildId);
  else if(i.commandName==='security'){if(!actor.permissions.has(P.ManageGuild))throw Error('Manage Server required');result=helpCard(i.guildId);}
  else if(i.commandName==='verify'){if(!actor.permissions.has(P.ModerateMembers))throw Error('Moderate Members required');const member=await i.guild.members.fetch(i.options.getUser('member',true).id);await verifyMember(i.guild,actor,member);result=notice('Member approved',`${member.user.username} was released from the VEX quarantine.`,0x60d5b1);}
  else if(i.commandName==='scan'){if(!actor.permissions.has(P.Administrator)||!entitled(plan(i.guildId),'scanner'))throw Error('Administrator and Ultimate required');const s=scan(i.guild);result=notice(`Configuration score · ${s.score}/100`,s.checks.map(c=>(c.ok?'✅ ':'⚠️ ')+c.name).join('\n')+'\n\nThis checklist is not a safety guarantee.');}
  else if(i.commandName==='lockdown'){if(actor.id!==i.guild.ownerId)throw Error('Server owner required');const enabled=i.options.getBoolean('enabled',true),out=await lockdown(i.guild,enabled,actor.id);result=notice(enabled?'Lockdown enabled':'Access restored',`Result:\n\`\`\`json\n${JSON.stringify(out).slice(0,2600)}\n\`\`\``,enabled?0xf2b96b:0x60d5b1);}
  else result=notice('Open VEX help','Use `/help` to explore commands and protection levels.');
  await i.editReply(result);
 }catch(e){await i.editReply(notice('Action could not be completed',e.message,0xee8292)).catch(()=>{});}
});
export async function startBot(){await client.login(env.token);}
