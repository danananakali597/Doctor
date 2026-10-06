export function commandsUI({h,raw,data,patch,mark,names=null,title='Command center',description='Give each command a clear place and audience. Changes apply as soon as you save them.'}){
 const editable=data.permissions?.includes('moderation')===true;
 const available=data.commands.filter(c=>!names||names.includes(c.name));
 let selected=available[0]?.name||'',query='';
 const current=name=>({...{enabled:true,allowedRoles:[],blockedRoles:[],allowedChannels:[],blockedChannels:[]},...data.settings.commandRules?.[name],...patch.commandRules?.[name]});
 const change=(name,key,value)=>{if(!editable)return;patch.commandRules??={};patch.commandRules[name]??={};patch.commandRules[name][key]=value;mark();};
 function draw(root){
  const oldSearch=root.querySelector('input[type=search]'),searching=document.activeElement===oldSearch,position=oldSearch?.selectionStart;
  const list=h('div',{class:'command-list'}),editor=h('div',{class:'command-editor'}),search=h('input',{type:'search',placeholder:'Search commands…','aria-label':'Search commands',value:query,onInput:e=>{query=e.target.value;draw(root);}});
  const filtered=available.filter(c=>(c.name+' '+c.description).toLowerCase().includes(query.toLowerCase()));
  list.append(h('div',{class:'command-list-head'},h('strong',{},'All commands'),h('span',{class:'tag'},String(filtered.length))),search);
  for(const c of filtered){const state=current(c.name);list.append(h('button',{class:'command-item'+(selected===c.name?' selected':''),onClick:()=>{selected=c.name;draw(root);}},h('span',{},h('strong',{},raw('/'+c.name)),h('small',{},raw(c.description))),h('i',{class:'nav-status'+(state.enabled?' on':''),'aria-label':state.enabled?'Enabled':'Disabled'})));}
  const c=available.find(x=>x.name===selected);if(c){const rule=current(c.name);editor.append(h('div',{class:'panel-head'},h('div',{},h('span',{class:'eyebrow'},'VEX · COMMAND CONTROL'),h('h2',{},raw('/'+c.name)),h('p',{},raw(c.description))),h('span',{class:'tag '+(c.moderator?'plus':'green')},c.moderator?'Discord permission required':'Community')));
   const toggle=h('input',{type:'checkbox',checked:rule.enabled,disabled:!editable||['help','commands','vex'].includes(c.name),onChange:e=>{change(c.name,'enabled',e.target.checked);draw(root);}});
   editor.append(h('label',{class:'command-toggle'},h('span',{},h('strong',{},'Command enabled'),h('small',{},'Switch off to reject new uses of this command.')),toggle));
   for(const [key,title,items] of [['allowedRoles','Only these roles',data.roles],['blockedRoles','Block these roles',data.roles],['allowedChannels','Only these channels',data.channels],['blockedChannels','Block these channels',data.channels]]){
    const picks=h('div',{class:'command-picks'});for(const item of items.filter(x=>key.includes('Roles')||[0,5,2].includes(x.type))){const checked=rule[key].includes(item.id);picks.append(h('label',{class:'command-pick'},h('input',{type:'checkbox',checked,disabled:!editable,onChange:e=>{if(e.target.checked&&rule[key].length>=25){e.target.checked=false;return;}const next=e.target.checked?[...rule[key],item.id]:rule[key].filter(id=>id!==item.id);rule[key]=next;change(c.name,key,next);const count=e.target.closest('details')?.querySelector('summary .tag');if(count)count.textContent=String(next.length);}}),h('span',{},raw((key.includes('Channels')?'# ':'')+item.name))));}
    editor.append(h('details',{class:'command-filter',open:rule[key].length>0},h('summary',{},title,h('span',{class:'tag'},String(rule[key].length))),picks));
   }
   if(!editable)editor.append(h('p',{class:'notice soft'},'Read-only access. Ask the server owner to update your permissions.'));
   editor.append(h('p',{class:'notice soft'},'Discord permissions and role hierarchy still apply. A blocked role takes priority. Leave an “Only” list empty to allow all roles or channels. Save changes using the bar below.'));
  }
  root.replaceChildren(h('section',{class:'command-intro'},h('span',{class:'eyebrow'},'COMMAND SETTINGS'),h('h2',{},title),h('p',{},description)),h('div',{class:'command-layout'},list,editor));
  if(searching){search.focus();search.setSelectionRange(position,position);}
 }
 return draw;
}
