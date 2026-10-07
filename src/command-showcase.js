import {getState,setState} from './db.js';
import {commandProfiles} from './command-profiles.js';
const officialGuild='1557341885649920002';
// One permanent command-navigation panel, sent by VEX in its official command channel.
// It contains no fabricated member data, actions, subscription claims or security scores.
export function showcasePayload(registered){
 const count=registered.filter(c=>c.type===1&&commandProfiles[c.name]).size??registered.filter(c=>c.type===1&&commandProfiles[c.name]).length;
 const text=content=>({type:10,content});
 return {flags:32768,allowedMentions:{parse:[]},components:[
  {type:17,accent_color:0xa78bfa,components:[text('## ✦ VEX · Command Experience'),text(`${count} command experiences, one private workspace.\n**هەر کۆماندێک، ڕێبەر و شێوازی تایبەتی خۆی.**\nUse **/commands** or open the atlas below to browse every registered command, its inputs and its workflow.`),{type:14,divider:true,spacing:1}]},
  {type:17,accent_color:0xa3e635,components:[text('### ✧ Community Studio'),text('**XP milestones · Leaderboards · Role & color galleries · Welcome journeys**\nExplore progress, choose configured roles and manage your community experience.')]},
  {type:17,accent_color:0x7dd3fc,components:[text('### 🛡️ Operations & Activity'),text('**Protection · Diagnostics · Moderation reviews · Server logs**\nRead real findings and event details. Review sensitive actions before confirming them.')]},
  {type:17,accent_color:0xc4b5fd,components:[text('### 🎟️ Your Spaces'),text('**Private support · Voice suites · AI conversation · Cinema**\nOpen each command’s guide for its actual controls, requirements and available inputs.')]},
  {type:1,components:[{type:2,style:1,label:'⌘ Open Command Atlas',custom_id:'vex:atlas:start'}]}
 ]};
}
export async function refreshCommandShowcase(client,registered){
 const g=client.guilds.cache.get(officialGuild);if(!g)return {published:false,reason:'guild_unavailable'};
 const channel=g.channels.cache.find(c=>[0,5].includes(c.type)&&/(^|[︱│|・-])commands$/.test(c.name));
 if(!channel?.messages)return {published:false,reason:'command_channel_unavailable'};
 const key='command-experience:showcase',old=getState(g.id,key,{}),payload=showcasePayload(registered);
 let message=old.channel===channel.id&&old.message?await channel.messages.fetch(old.message).catch(e=>{if(e.code===10008)return null;throw e;}):null;
 if(message&&message.author.id!==client.user.id)throw Error('Command showcase owner mismatch');
 const created=!message;
 if(message)message=await message.edit({...payload,content:null,embeds:[]});else message=await channel.send(payload);
 // Exercise the edit path too: native cards cannot revert to traditional content/embeds.
 if(created)message=await message.edit({...payload,content:null,embeds:[]});
 setState(g.id,key,{channel:channel.id,message:message.id,version:1});
 return {published:true,created,channel:channel.id,message:message.id,native:message.flags.has(32768)};
}
