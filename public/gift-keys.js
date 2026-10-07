export function giftKeysUI(root,{h,button,api,toast,refresh,guildId,operator,date,t=value=>value}){
 const keyInput=h('input',{type:'text',placeholder:'Enter your VEX key',autocomplete:'off',maxlength:60,'aria-label':'Enter your VEX key'});
 const redeem=button('Activate one-month access',async()=>{
  redeem.disabled=true;
  try{await api(`/api/guilds/${guildId}/redeem-key`,{method:'POST',body:JSON.stringify({key:keyInput.value})});keyInput.value='';await refresh();toast('One-month access activated.');}
  catch(e){toast(e.message,true);}finally{redeem.disabled=false;}
 });
 root.append(h('section',{class:'panel'},h('h2',{},'Activate a gift key'),h('p',{class:'muted'},'Only the server owner can activate a key. Each key works once for one server. The month starts on activation; the same plan extends existing access. Activate a different plan after your current plan expires.'),h('label',{class:'field'},'Gift key',keyInput),redeem));
 if(!operator)return;
 const tier=h('select',{'aria-label':'Gift plan'},h('option',{value:'plus'},'Plus'),h('option',{value:'ultimate'},'Ultimate'));
 const output=h('div'),list=h('div');
 const panel=h('section',{class:'panel'},h('h2',{},'Private gift keys'),h('p',{class:'muted'},'Only you can create, view and revoke these keys. Copy each new key now; its full value is shown only once.'),h('label',{class:'field'},'Gift plan',tier),output,list);
 async function reload(){
  try{const data=await api('/api/operator/gift-keys');if(!panel.isConnected)return;list.replaceChildren();
   for(const item of data.keys){const row=h('div',{class:'panel'},h('strong',{},item.plan.toUpperCase()),h('p',{},({unused:'Unused key',redeemed:'Redeemed key',revoked:'Revoked key'})[item.status]),h('small',{},date(item.createdAt)));
    if(item.guild)row.append(h('p',{},'Server ID',h('code',{},document.createTextNode(item.guild))),h('p',{},'Redeemed by',h('code',{},document.createTextNode(item.redeemedBy))),h('p',{},'Activated on',document.createTextNode(' '+date(item.redeemedAt))),h('p',{},'Access ends',document.createTextNode(' '+date(item.expires))));
    if(item.status==='unused')row.append(button('Revoke key',async()=>{if(!confirm(t('Revoke this unused key?')))return;try{await api(`/api/operator/gift-keys/${item.id}/revoke`,{method:'POST',body:'{}'});await reload();toast('Key revoked.');}catch(e){toast(e.message,true);}}));
    list.append(row);
   }
   if(!data.keys.length)list.append(h('p',{class:'muted'},'No gift keys yet.'));
  }catch(e){if(panel.isConnected)list.replaceChildren(h('p',{class:'notice'},e.message));}
 }
 const create=button('Create one-month key',async()=>{
  create.disabled=true;
  try{const data=await api('/api/operator/gift-keys',{method:'POST',body:JSON.stringify({plan:tier.value})});
   const value=h('input',{type:'text',readonly:true,value:data.key,'aria-label':'New gift key'});
   output.replaceChildren(h('div',{class:'notice soft'},h('p',{},'Copy this key before leaving this page.'),h('strong',{},data.plan.toUpperCase()),h('label',{class:'field'},'New gift key',value),button('Copy key',async()=>{try{await navigator.clipboard.writeText(data.key);toast('Key copied.');}catch{value.select();toast('Select and copy the key manually.',true);}})));
   await reload();
  }catch(e){toast(e.message,true);}finally{create.disabled=false;}
 });
 panel.insertBefore(create,output);root.append(panel);void reload();
}
