export function journeySettings(root,ctx,input){
 const {h,data,config,change}=ctx,spec=data.communityModules.find(m=>m.id==='welcome');
 const fields=['journeyEnabled','sayHiEnabled','chatChannelId','rulesChannelId'];
 const controls=fields.map(key=>{const field=spec.fields.find(f=>f.key===key);if(!field)return null;const control=input(field,config('welcome')[key]??field.value,v=>change('welcome',key,v));if(!data.guild.owner)for(const el of control.querySelectorAll('input,select,button'))el.disabled=true;return control;}).filter(Boolean);
 root.append(h('section',{class:'panel'},h('h2',{},'Welcome journey'),h('p',{class:'muted'},'The server owner chooses the introduction and rules channels. Say Hi opens the channel; members write their own message.'),h('div',{class:'fields'},...controls),h('p',{class:'muted'},'Completion requires rules acknowledgement, optional roles chosen or skipped, and a real introduction when enabled. Save your settings to apply.')));
}
