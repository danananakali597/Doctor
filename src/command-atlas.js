import {ActionRowBuilder as Row,ButtonBuilder as Button,ButtonStyle as Style,StringSelectMenuBuilder as Select,EmbedBuilder,PermissionsBitField,escapeMarkdown} from 'discord.js';
import {commands} from './commands.js';
import {commandAccess} from './command-policy.js';
import {commandGroups,commandProfiles,profileFor} from './command-profiles.js';
import {deferPrivate} from './interaction-response.js';
import {env} from './config.js';
import {plan} from './db.js';
const copy={en:['All commands','Choose a category','Choose a command','Search','Previous','Next','Browse all','Inputs','Workflow','Access','Required','Optional','No results','Run the command','Choose a subcommand','Search by command or feature','Command or feature'],ckb:['هەموو کۆماندەکان','بەشێک هەڵبژێرە','کۆماندێک هەڵبژێرە','گەڕان','پێشوو','دواتر','بینینی هەمووی','زانیارییە پێویستەکان','هەنگاوەکان','دەستگەیشتن','پێویست','ئارەزوومەندانە','ئەنجام نییە','بەکارهێنانی کۆماند','ژێرکۆماندێک هەڵبژێرە','بە کۆماند یان تایبەتمەندی بگەڕێ','کۆماند یان تایبەتمەندی'],ar:['كل الأوامر','اختر قسماً','اختر أمراً','بحث','السابق','التالي','تصفح الكل','المدخلات','الخطوات','الوصول','مطلوب','اختياري','لا توجد نتائج','استخدام الأمر','اختر أمراً فرعياً','ابحث عن أمر أو ميزة','الأمر أو الميزة'],tr:['Tüm komutlar','Kategori seç','Komut seç','Ara','Önceki','Sonraki','Tümünü gör','Girdiler','İş akışı','Erişim','Gerekli','İsteğe bağlı','Sonuç yok','Komutu kullan','Alt komut seç','Komut veya özellik ara','Komut veya özellik']};
const groups={en:['Workspace','Community','Security','Moderation','Support','Voice','Server logs','AI','Cinema'],ckb:['ناوەندی کۆنترۆڵ','کۆمەڵگا','پاراستن','بەڕێوەبردن','پشتیوانی','دەنگ','لۆگەکانی سێرڤەر','زیرەکی دەستکرد','سینەما'],ar:['التحكم','المجتمع','الحماية','الإشراف','الدعم','الصوت','سجلات الخادم','الذكاء الاصطناعي','السينما'],tr:['Kontroller','Topluluk','Güvenlik','Moderasyon','Destek','Ses','Sunucu kayıtları','Yapay zekâ','Sinema']};
const word=(l,n)=>(copy[l]||copy.en)[n];
const safe=(v,n=500)=>escapeMarkdown(String(v??'')).slice(0,n);
export const atlasId=(i,l,verb,arg='')=>`vex:atlas:${i.user.id}:${i.guildId}:${l}:${verb}:${arg}`;
const button=(i,l,verb,label,arg='',disabled=false)=>new Button().setCustomId(atlasId(i,l,verb,arg)).setLabel(label).setStyle(Style.Secondary).setDisabled(disabled);
export function liveCatalogue(client){
 const cached=client?.application?.commands?.cache;
 const live=cached?.size?[...cached.values()].map(c=>c.toJSON?c.toJSON():c):commands;
 return live.filter(c=>c.type===undefined||c.type===1).filter(c=>profileFor(c.name)).sort((a,b)=>a.name.localeCompare(b.name));
}
export function cataloguePage(catalogue,group='all',page=0,query=''){
 const needle=query.toLocaleLowerCase().trim();const list=catalogue.filter(c=>(group==='all'||profileFor(c.name)?.group===group)&&(!needle||[c.name,c.description,profileFor(c.name)?.label,profileFor(c.name)?.ckb,profileFor(c.name)?.group].join(' ').toLocaleLowerCase().includes(needle)));
 const pages=Math.max(1,Math.ceil(list.length/20)),selected=Math.min(Math.max(0,Number(page)||0),pages-1);
 return {list,page:selected,pages,items:list.slice(selected*20,selected*20+20)};
}
function languageRow(i,l){return new Row().addComponents(new Select().setCustomId(atlasId(i,l,'language')).setPlaceholder('Language / زمان').addOptions(['en','ckb','ar','tr'].map((v,n)=>({label:['English','کوردی','العربية','Türkçe'][n],value:v,default:v===l}))));}
function dashboard(i,l,name='commands'){return new Button().setLabel(l==='ckb'?'داشبۆرد':'Dashboard').setStyle(Style.Link).setURL(env.publicUrl+'/?guild='+i.guildId+'&section='+encodeURIComponent(profileFor(name)?.section||'commands'));}
export function atlasPage(i,{locale='en',group='all',page=0,query=''}={}){
 const catalogue=liveCatalogue(i.client),view=cataloguePage(catalogue,group,page,query);
 const category=new Row().addComponents(new Select().setCustomId(atlasId(i,locale,'category')).setPlaceholder(word(locale,1)).addOptions([{label:word(locale,0),value:'all',default:group==='all'},...commandGroups.map((g,n)=>({label:groups[locale][n],value:g,default:g===group}))]));
 const rows=[category];
 if(view.items.length)rows.push(new Row().addComponents(new Select().setCustomId(atlasId(i,locale,'open')).setPlaceholder(word(locale,2)).addOptions(view.items.map(c=>({label:'/'+c.name,value:c.name,description:(locale==='ckb'?profileFor(c.name).ckb:c.description||profileFor(c.name).label).slice(0,100)})))));
 rows.push(languageRow(i,locale),new Row().addComponents(button(i,locale,'search',word(locale,3)),button(i,locale,'page',word(locale,4),group+','+(view.page-1),view.page===0||!!query),button(i,locale,'page',word(locale,5),group+','+(view.page+1),view.page===view.pages-1||!!query),dashboard(i,locale)));
 const list=view.items.map(c=>`${profileFor(c.name).icon} **/${c.name}** — ${safe(locale==='ckb'?profileFor(c.name).ckb:profileFor(c.name).label,80)}`).join('\n');
 const embed=new EmbedBuilder().setTitle(locale==='ckb'?'نەخشەی کۆماندەکانی VEX':'VEX Command Atlas').setDescription(`${catalogue.length} commands · ${view.page+1}/${view.pages}${query?' · '+safe(query,60):''}\n\n${list||word(locale,12)}`).setColor(0xc4b5fd).setFooter({text:'Choose a command to see its own workflow and registered inputs.'});
 return {embeds:[embed],components:rows,allowedMentions:{parse:[]}};
}
export function inputGuide(options,locale='en'){
 return (options||[]).filter(o=>o.type>2).map(o=>{
  const choices=o.choices?.map(c=>`${safe(c.name,300)} → \`${safe(c.value,300)}\``).join(' · ');
  const bounds=[o.min_value!==undefined?'min '+o.min_value:null,o.max_value!==undefined?'max '+o.max_value:null,o.min_length!==undefined?'min '+o.min_length+' characters':null,o.max_length!==undefined?'max '+o.max_length+' characters':null].filter(Boolean).join(' · ');
  const type={3:'Text',4:'Integer',5:'Yes / No',6:'Member',7:'Channel',8:'Role',9:'Mentionable',10:'Number',11:'Attachment'}[o.type]||'Input';
  return `**${safe(o.name,40)}** · ${word(locale,o.required?10:11)} · ${type}\n${safe(o.description,300)}${choices?'\n'+choices:''}${bounds?'\n'+bounds:''}`;
 }).join('\n\n');
}
const permissionValue=c=>c.default_member_permissions??c.defaultMemberPermissions?.bitfield;
export function accessReason(i,actor,command){
 const denied=commandAccess(i.guildId,command.name,actor,i.channel);if(denied)return denied;
 const required=permissionValue(command);if(required&&BigInt(required)!==0n&&!actor.permissions.has(BigInt(required)))return 'Discord permission required: '+new PermissionsBitField(BigInt(required)).toArray().join(', ');
 return null;
}
function registeredMention(c,sub){return c.id?`</${c.name}${sub?' '+sub:''}:${c.id}>`:'`/'+c.name+(sub?' '+sub:'')+'`';}
export function commandPaths(c){return (c.options||[]).filter(o=>o.type<=2).flatMap(o=>o.type===2?(o.options||[]).map(s=>({...s,name:o.name+' '+s.name})):[o]);}
export function commandDetail(i,actor,name,locale='en',sub=''){
 const c=liveCatalogue(i.client).find(c=>c.name===name);if(!c)throw Error('This command is not registered by the running bot.');
 const p=profileFor(name),branches=commandPaths(c),branch=branches.find(o=>o.name===sub)||branches[0],opts=branch?.options||c.options||[];
 const denied=accessReason(i,actor,c),perms=permissionValue(c);
 const fields=[{name:word(locale,8),value:p.steps.map((s,n)=>`**${n+1}** · ${s}`).join('\n')},{name:word(locale,9),value:(denied?'🔒 '+denied:'✓ Your command policy and Discord permissions allow opening this command here.')+'\nServer plan: **'+plan(i.guildId).toUpperCase()+'**'+(perms?'\n'+new PermissionsBitField(BigInt(perms)).toArray().join(', '):'')+'\nFeature switches, hierarchy and plan requirements are checked when the command runs.'}];
 const inputs=inputGuide(opts,locale);if(inputs){const parts=[];for(let n=0;n<inputs.length;n+=1000)parts.push({name:word(locale,7)+(n?' · '+(parts.length+1):''),value:inputs.slice(n,n+1000)});fields.splice(1,0,...parts);}
 const embed=new EmbedBuilder().setTitle(p.icon+' '+(locale==='ckb'?p.ckb:p.label)).setColor(p.color).setDescription(`${safe(c.description,300)}\n\n**${word(locale,13)}**\n${registeredMention(c,branch?.name)}\n\n${p.tip}`).addFields(fields);
 const rows=[];
 if(branches.length)rows.push(new Row().addComponents(new Select().setCustomId(atlasId(i,locale,'sub',name)).setPlaceholder(word(locale,14)).addOptions(branches.slice(0,25).map(b=>({label:b.name,value:b.name,description:(b.description||'').slice(0,100),default:b.name===branch?.name})))));
 rows.push(new Row().addComponents(button(i,locale,'category',word(locale,6),'all'),button(i,locale,'category',groups[locale][commandGroups.indexOf(p.group)],p.group),dashboard(i,locale,name)),languageRow(i,locale));
 return {embeds:[embed],components:rows,allowedMentions:{parse:[]}};
}
export const handlesAtlas=i=>!!i.guild&&(i.isChatInputCommand?.()&&['help','commands'].includes(i.commandName)||i.customId?.startsWith('vex:atlas:'));
export async function atlasInteraction(i){
 if(!handlesAtlas(i))return false;let locale='en';
 try{
  if(i.isChatInputCommand?.()||i.customId==='vex:atlas:start'){
   locale=i.options?.getString?.('language')||'en';if(!copy[locale])locale='en';i.vexLocale=locale;i.vexCommandName=i.commandName||'commands';
   await deferPrivate(i);const actor=await i.guild.members.fetch({user:i.user.id,force:true});
   const name=i.commandName||'commands',entry=liveCatalogue(i.client).find(c=>c.name===name)||commands.find(c=>c.name===name),denied=accessReason(i,actor,entry);if(denied)throw Error(denied);
   await i.editReply(atlasPage(i,{locale}));return true;
  }
  const [, ,owner,guild,l,verb,arg]=i.customId.split(':');locale=copy[l]?l:'en';i.vexLocale=locale;i.vexCommandName='commands';
  if(owner!==i.user.id||guild!==i.guildId){await i.reply({content:'Open /commands to create your own private guide.',flags:64});return true;}
  if(verb==='search'){
   await i.showModal({custom_id:atlasId(i,locale,'results'),title:word(locale,15).slice(0,45),components:[{type:18,label:word(locale,16),component:{type:4,custom_id:'query',style:1,required:true,min_length:1,max_length:80,placeholder:'rank, roles, voice, logs…'}}]});return true;
  }
  if(!i.deferred&&!i.replied)await i.deferUpdate();
  const actor=await i.guild.members.fetch({user:i.user.id,force:true});
  const entry=liveCatalogue(i.client).find(c=>c.name==='commands')||commands.find(c=>c.name==='commands'),denied=accessReason(i,actor,entry);if(denied)throw Error(denied);
  let payload;
  if(verb==='open'||verb==='sub'){const name=verb==='open'?arg||i.values?.[0]:arg;i.vexCommandName=name;payload=commandDetail(i,actor,name,locale,verb==='sub'?i.values?.[0]:'');}
  else if(verb==='results')payload=atlasPage(i,{locale,query:i.fields.getTextInputValue('query').trim()});
  else if(verb==='language'){locale=copy[i.values?.[0]]?i.values[0]:'en';i.vexLocale=locale;payload=atlasPage(i,{locale});}
  else if(verb==='category')payload=atlasPage(i,{locale,group:commandGroups.includes(arg||i.values?.[0])?arg||i.values[0]:'all'});
  else if(verb==='page'){const [group,page]=arg.split(',');payload=atlasPage(i,{locale,group:commandGroups.includes(group)?group:'all',page:Number(page)});}
  else throw Error('Open /commands again to refresh your guide.');
  await i.editReply(payload);
 }catch(e){const payload={content:String(e.message||'Unable to open the guide.'),embeds:[],components:[],allowedMentions:{parse:[]}};if(i.deferred||i.replied)await i.editReply(payload).catch(()=>{});else await i.reply({...payload,flags:64}).catch(()=>{});}
 return true;
}
