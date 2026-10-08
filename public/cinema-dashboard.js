import {translations} from './i18n.js';
const rows=[
 ['Cinema','السينما','سینەما'],
 ['Choose a movie. Watch together in Discord.','اختر فيلماً وشاهدوه معاً داخل Discord.','فیلمێک هەڵبژێرە و لە Discord پێکەوە تەماشای بکەن.'],
 ['Kurd Cinema movie link','رابط فيلم كورد سينما','لینکی فیلمی کورد سینەما'],
 ['Check movie servers','فحص خوادم الفيلم','پشکنینی سێرڤەرەکانی فیلم'],
 ['Checking…','جارٍ الفحص…','پشکنین…'],
 ['Available servers','الخوادم المتاحة','سێرڤەرە بەردەستەکان'],
 ['Select a server','اختر خادماً','سێرڤەرێک هەڵبژێرە'],
 ['Use this link in VEX Cinema Activity','استخدم هذا الرابط في VEX Cinema Activity','ئەم لینکە لە VEX Cinema Activity بەکاربهێنە'],
 ['Open Kurd Cinema','فتح كورد سينما','کردنەوەی کورد سینەما'],
 ['Join a Discord voice channel, open VEX Cinema from Activities, then paste the movie link and select a server.','انضم إلى قناة صوتية في Discord، وافتح VEX Cinema من الأنشطة، ثم ضع رابط الفيلم واختر خادماً.','بچۆ ژوورە دەنگییەکی Discord، لە Activities ـەوە VEX Cinema بکەرەوە، پاشان لینکی فیلم دابنێ و سێرڤەر هەڵبژێرە.'],
 ['Checking a link here does not start a Discord session.','فحص الرابط هنا لا يبدأ جلسة Discord.','پشکنینی لینک لێرە ژووری Discord دەست پێ ناکات.'],
 ['VEX checks the movie servers automatically for an accessible MP4/HLS video. Playback depends on the source.','يفحص VEX خوادم الفيلم تلقائياً للعثور على فيديو MP4/HLS متاح. التشغيل يعتمد على المصدر.','VEX بە ئۆتۆماتیکی سێرڤەرەکانی فیلم بۆ ڤیدیۆی MP4/HLSی بەردەست دەپشکنێت. پەخش بە سەرچاوەکە بەستراوە.'],
 ['Enter a Kurd Cinema movie link.','أدخل رابط فيلم من كورد سينما.','لینکی فیلمێکی کورد سینەما دابنێ.'],
 ['No servers were found for this movie.','لم يتم العثور على خوادم لهذا الفيلم.','هیچ سێرڤەرێک بۆ ئەم فیلمە نەدۆزرایەوە.'],
 ['Direct video source found. Test playback inside Discord.','تم العثور على مصدر فيديو مباشر. تحقق من التشغيل داخل Discord.','سەرچاوەی ڤیدیۆی ڕاستەوخۆ دۆزرایەوە. پەخشکردنی لە ناو Discord تاقی بکەرەوە.'],
 ['No accessible MP4/HLS video source was found for this movie','لم يتم العثور على مصدر فيديو MP4/HLS متاح لهذا الفيلم','هیچ سەرچاوەی ڤیدیۆی MP4/HLSی بەردەست بۆ ئەم فیلمە نەدۆزرایەوە'],
 ['Could not check this server. Try another server.','تعذّر فحص هذا الخادم. جرّب خادماً آخر.','نەتوانرا ئەم سێرڤەرە بپشکنرێت. سێرڤەرێکی تر تاقی بکەرەوە.'],
 ['Cinema commands','أوامر السينما','کۆماندەکانی سینەما']
];
for(const [en,ar,ckb] of rows)translations[en]={ar,ckb};
export function cinemaMovieLink(value){
 try{const u=new URL(value.trim());if(u.protocol!=='https:'||u.username||u.password||u.port||!['kurdcinama.com','www.kurdcinama.com','kurdcinema.com','www.kurdcinema.com'].includes(u.hostname)||!/^\/(moves-details|online)\.aspx$/i.test(u.pathname)||u.searchParams.getAll('movieid').length!==1||!/^\d{1,10}$/.test(u.searchParams.get('movieid')))return null;return 'https://kurdcinama.com/online.aspx?movieid='+u.searchParams.get('movieid');}catch{return null;}
}
export function cinemaDashboard(root,{h,raw,t,api,data,commandPanel}){
 const initial=data.settings?.community?.cinema?.mediaUrl||'';
 const url=h('input',{type:'url',value:initial,placeholder:'https://kurdcinama.com/moves-details.aspx?movieid=…','aria-label':'Kurd Cinema movie link',maxlength:2048});
 const result=h('section',{class:'panel',hidden:true}),status=h('p',{'aria-live':'polite',role:'status'});
 let generation=0,serverGeneration=0;
 const check=h('button',{type:'button',class:'button primary',onClick:async()=>{
  const movie=cinemaMovieLink(url.value),current=++generation;serverGeneration++;result.replaceChildren();result.hidden=true;
  if(!movie){status.textContent=t('Enter a Kurd Cinema movie link.');return;}
  check.disabled=true;check.textContent=t('Checking…');status.textContent=t('Checking…');
  try{
   const resolved=await api('/activity/api/kc/resolve?'+new URLSearchParams({url:movie}));if(current!==generation||!root.isConnected)return;
   const servers=(resolved.servers||[]).filter(s=>/^\d+$/.test(String(s.id)));if(!servers.length)throw Error(t('No servers were found for this movie.'));
   const select=h('select',{'aria-label':'Select a server'},servers.map(s=>h('option',{value:s.id},raw(s.label||s.id))));
   const serverStatus=h('p',{'aria-live':'polite',role:'status'});
   async function inspect(serverId){const request=++serverGeneration;serverStatus.textContent=t('Checking…');try{const response=await api('/activity/api/kc/media?'+new URLSearchParams({url:movie,...(serverId?{serverId}:{})}));if(current!==generation||request!==serverGeneration||!root.isConnected)return;if(!['mp4','hls'].includes(response.format)||!/^\/activity\/api\/kc\/stream\/[a-f0-9]{48}$/.test(response.streamPath))throw Error('Invalid video source');if(response.serverId)select.value=String(response.serverId);serverStatus.textContent=t('Direct video source found. Test playback inside Discord.');}catch(e){if(current===generation&&request===serverGeneration&&root.isConnected)serverStatus.textContent=t(e.message||'Could not check this server. Try another server.');}}
   select.addEventListener('change',()=>inspect(select.value));
   result.append(h('h2',{},raw(resolved.title||'Kurd Cinema')),h('label',{class:'field'},'Available servers',select),serverStatus,h('label',{class:'field'},'Use this link in VEX Cinema Activity',h('input',{value:movie,readonly:true,'aria-label':'Use this link in VEX Cinema Activity'})),h('a',{class:'button',href:movie,target:'_blank',rel:'noopener noreferrer'},'Open Kurd Cinema'));
   result.hidden=false;status.textContent='';void inspect();
  }catch(e){if(current===generation&&root.isConnected)status.textContent=e.message;}
  finally{if(current===generation){check.disabled=false;check.textContent=t('Check movie servers');}}
 }},'Check movie servers');
 url.addEventListener('input',()=>{generation++;serverGeneration++;check.disabled=false;check.textContent=t('Check movie servers');result.hidden=true;status.textContent='';});
 root.append(h('section',{class:'panel community-hero'},h('span',{class:'eyebrow'},raw('VEX · CINEMA')),h('h2',{},'Choose a movie. Watch together in Discord.'),h('p',{},'Join a Discord voice channel, open VEX Cinema from Activities, then paste the movie link and select a server.')),h('section',{class:'panel'},h('label',{class:'field'},'Kurd Cinema movie link',url),h('div',{class:'toolbar'},check),status,h('p',{class:'muted'},'Checking a link here does not start a Discord session.')),result,h('div',{class:'notice soft'},'VEX checks the movie servers automatically for an accessible MP4/HLS video. Playback depends on the source.'));
 const commands=(data.commands||[]).filter(c=>['launch','cinema','watch','activity'].includes(c.name)).map(c=>c.name);if(commands.length&&commandPanel){const panel=h('section',{class:'panel'});root.append(panel);commandPanel(panel,commands,t('Cinema commands'));}
}
