import {decorateWelcome} from './welcome-journey.js';
import {EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle} from 'discord.js';
export function welcomeText(value,g,m){const values={user:`<@${m.id}>`,username:m.user.username,displayname:m.displayName||m.user.username,server:g.name,count:String(g.memberCount),id:m.id,serverid:g.id};return String(value||'').replace(/\{(user|username|displayname|server|count|id|serverid)\}/g,(_,key)=>values[key]);}
function legacyWelcomePayload(g,c,m){
 const text=(v,max)=>welcomeText(v,g,m).slice(0,max),payload={allowedMentions:{parse:[],users:c.mentionMember?[m.id]:[]}};
 if(c.format==='text')payload.content=text([c.content,c.title,c.message].filter(Boolean).join('\n\n'),2000)||'Welcome!';
 else{const embed=new EmbedBuilder().setColor(c.color||'#8270f5').setTitle(text(c.title,256)||'Welcome!').setDescription(text(c.message,2000)||'Welcome to the community.');
 if(c.author)embed.setAuthor({name:text(c.author,120)});if(c.footer)embed.setFooter({text:text(c.footer,200)});if(c.timestamp)embed.setTimestamp();if(c.imageUrl)embed.setImage(c.imageUrl);
 const portrait=c.thumbnail==='member'?m.user.displayAvatarURL?.({size:256}):c.thumbnail==='server'?g.iconURL?.({size:256}):c.thumbnail==='custom'?c.thumbnailUrl:null;if(portrait)embed.setThumbnail(portrait);
 if(c.fields?.length)embed.addFields(c.fields.slice(0,6).map(f=>({name:text(f.name,100)||'\u200b',value:text(f.value,400)||'\u200b',inline:!!f.inline})));
 payload.embeds=[embed];if(c.content)payload.content=text(c.content,1000);
 }
 if(c.buttons?.length)payload.components=[new ActionRowBuilder().addComponents(c.buttons.slice(0,5).map(b=>new ButtonBuilder().setLabel(b.label.slice(0,80)).setStyle(ButtonStyle.Link).setURL(b.url)))];
 return payload;
}

export function welcomePayload(g,c,m){return decorateWelcome(legacyWelcomePayload(g,c,m),g,c,m);}
