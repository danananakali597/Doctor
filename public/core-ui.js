// Shared directory rules: every command has one settings destination.
export const commandModule=name=>({
 'vex-security':'security-center',logs:'serverlogs',vex:'commands',help:'commands',commands:'commands',security:'protection',scan:'insights',lockdown:'response',verify:'module:verification',
 welcome:'community:welcome',rank:'community:levels',leaderboard:'community:levels',top:'community:levels',setxp:'community:levels',setlevel:'community:levels',resetxp:'community:levels',
 roles:'community:selfroles',colors:'community:selfroles',color:'community:selfroles',invite:'community:templinks',starboard:'community:starboard',ticket:'community:tickets',
 room:'community:tempvoice',moveme:'community:tempvoice',move:'community:tempvoice',vkick:'community:tempvoice',ask:'ai-chat','ai-security':'ai-security',
 }[name]||(/cinema|watch|activity|blackout|game|play/.test(name)?'community:cinema':'community:moderation'));
export const commandFlow=name=>['warn','timeout','untimeout','kick','ban','unban','clear','moderate'].includes(name)?'Review → Confirm → Case record':['vex','help','commands','security'].includes(name)?'Open → Choose section → Control':'Run → Check access → Result';
export function organizedNavigation(groups){
 const output=[['WORKSPACE',[]],['SECURITY',[]],['COMMUNITY',[]],['VOICE',[]],['SUPPORT & MODERATION',[]],['LOGS',[]],['AI & ENTERTAINMENT',[]],['WORKSPACE TOOLS',[]],['ACCOUNT',[]]];
 const seen=new Set();
 for(const [,items]of groups)for(const item of items){const id=item[0];if(seen.has(id))continue;seen.add(id);
  const n=['security-center','protection','access','response','insights','ai-security'].includes(id)?1:['community:welcome','community:goodbye','community:templinks','community:responder','community:autoroles','community:levels','community:selfroles','community:starboard','community:statistics'].includes(id)?2:id==='community:tempvoice'?3:['community:tickets','community:moderation'].includes(id)?4:['serverlogs','monitoring','panellogs'].includes(id)?5:['ai','ai-chat','community:cinema','community:games','community:notifications'].includes(id)?6:['inbox','history','team','appearance'].includes(id)?7:id==='plans'?8:0;
  output[n][1].push(item);
 }
 if(!seen.has('commands'))output[0][1].push(['commands','⌘','Command center']);
 for(const [id,glyph,label]of [['setup','✓','Setup assistant'],['incidents','!','Incident center'],['automations','↻','Automations'],['backups','↶','Manual backups']])if(!seen.has(id))output[0][1].push([id,glyph,label]);
 return output.filter(([,items])=>items.length);
}
export function dashboardRoute(raw,data){
 if(typeof raw!=='string')return 'overview';
 const standard=['security-center','operator','overview','commands','setup','incidents','automations','backups','community','protection','serverlogs','monitoring','panellogs','access','response','insights','plans','inbox','history','team','appearance'];
 if(standard.includes(raw))return raw;
 if(raw.startsWith('community:')&&data.communityModules.some(m=>'community:'+m.id===raw))return raw;
 if(raw.startsWith('module:')&&data.modules.some(m=>'module:'+m.id===raw))return raw;
 if(['ai-chat','ai-security'].includes(raw)&&data.commands?.some(c=>/ai|ask/.test(c.name)))return raw;
 return 'overview';
}
export function commandDirectory(ctx,root){
 const {h,raw,data,button,navigate,renderRules}=ctx;
 const select=h('select',{'aria-label':'Command category'},h('option',{value:'all'},'All commands'));
 const destinations=[...new Set(data.commands.map(c=>commandModule(c.name)))];
 const name=id=>id==='commands'?'Command center':data.communityModules.find(m=>'community:'+m.id===id)?.name||({protection:'Security',insights:'Scanner',response:'Incident response','module:verification':'Verification','ai-chat':'AI Chat','ai-security':'AI Security'})[id]||id;
 for(const id of destinations)select.append(h('option',{value:id},name(id)));
 const grid=h('div',{class:'core-command-grid'}),rules=h('div');
 const search=h('input',{type:'search',placeholder:'Search commands…','aria-label':'Search commands'});
 const draw=()=>{grid.replaceChildren();for(const c of data.commands.filter(c=>(select.value==='all'||commandModule(c.name)===select.value)&&(c.name+' '+c.description).toLowerCase().includes(search.value.toLowerCase()))){
  const destination=commandModule(c.name),enabled=data.settings.commandRules?.[c.name]?.enabled!==false;
  grid.append(h('article',{class:'module-card'},h('div',{class:'panel-head'},h('strong',{},raw('/'+c.name)),h('span',{class:'tag '+(enabled?'green':'muted')},enabled?'Enabled':'Disabled')),h('p',{},raw(c.description)),h('small',{class:'eyebrow'},name(destination)),h('p',{class:'core-flow'},commandFlow(c.name)),h('div',{class:'toolbar'},button('Command access',()=>{rules.replaceChildren();renderRules(rules,[c.name],'/'+c.name);rules.scrollIntoView({behavior:'smooth',block:'start'});}),destination!=='commands'?button('Open module',()=>navigate(destination)):null)));
 }if(!grid.childElementCount)grid.append(h('p',{},'No matching commands'));};
 search.oninput=draw;select.onchange=draw;draw();
 root.append(h('section',{class:'panel core-intro'},h('span',{class:'eyebrow'},'VEX // COMMAND CORE'),h('h2',{},'One command. Your whole server.'),h('p',{},'Open /vex in Discord. Browse sections in one private message. Moderation actions show a review before confirmation.'),h('div',{class:'core-command-stats'},h('strong',{},raw(data.commands.length)),h('span',{},'Registered commands'))),h('div',{class:'module-toolbar'},search,select),grid,rules);
}
export const coreRows=[
 ['Every command, its workflow and its settings.','كل أمر وطريقة استخدامه وإعداداته.','هەر کۆماند و شێوازی کارکردن و ڕێکخستنەکانی.','Her komut, iş akışı ve ayarları.'],
 ['SECURITY','الحماية','پاراستن','GÜVENLİK'],['VOICE','الصوت','دەنگ','SES'],['SUPPORT & MODERATION','الدعم والإشراف','پشتیوانی و بەڕێوەبردن','DESTEK VE MODERASYON'],['LOGS','السجلات','لۆگەکان','KAYITLAR'],['AI & ENTERTAINMENT','الذكاء الاصطناعي والترفيه','زیرەکی دەستکرد و کات بەسەربردن','YAPAY ZEKÂ VE EĞLENCE'],
 ['Command center','مركز الأوامر','ناوەندی کۆماندەکان','Komut merkezi'],['Command access','صلاحيات الأمر','دەسەڵاتی کۆماند','Komut erişimi'],['Open module','فتح القسم','کردنەوەی بەش','Modülü aç'],['Command category','فئة الأوامر','جۆری کۆماندەکان','Komut kategorisi'],['All commands','جميع الأوامر','هەموو کۆماندەکان','Tüm komutlar'],['Registered commands','أوامر مسجلة','کۆماندە تۆمارکراوەکان','Kayıtlı komutlar'],['One command. Your whole server.','أمر واحد لإدارة خادمك.','یەک کۆماند بۆ سێرڤەرەکەت.','Tek komut. Tüm sunucun.'],
 ['Open /vex in Discord. Browse sections in one private message. Moderation actions show a review before confirmation.','افتح /vex في ديسكورد. تنقل بين الأقسام في رسالة خاصة واحدة. راجع إجراءات الإشراف قبل التأكيد.','لە دیسکۆرد /vex بکەرەوە. بە یەک پەیامی تایبەت بەشەکان ببینە. پێش پشتڕاستکردنەوەی کردار پێداچوونەوە بکە.','Discord’da /vex açın. Bölümleri tek bir özel mesajda gezin. Moderasyon işlemlerini onaylamadan önce inceleyin.'],
 ['Review → Confirm → Case record','مراجعة ← تأكيد ← سجل الحالة','پێداچوونەوە ← پشتڕاستکردنەوە ← کەیس','İncele → Onayla → Vaka kaydı'],['Open → Choose section → Control','فتح ← اختيار القسم ← تحكم','کردنەوە ← هەڵبژاردنی بەش ← کۆنترۆڵ','Aç → Bölüm seç → Yönet'],['Run → Check access → Result','تشغيل ← تحقق الصلاحيات ← النتيجة','کارپێکردن ← پشکنینی دەسەڵات ← ئەنجام','Çalıştır → Erişimi kontrol et → Sonuç']
];
