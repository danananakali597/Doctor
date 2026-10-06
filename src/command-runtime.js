import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
export function integrateResponses(source,{early=false}={}) {
 const header="import {deferPrivate,respondPrivate} from './interaction-response.js';";
 if(!source.includes(header))source=header+'\n'+source;
 source=source.replace(/await i\.deferReply\(\{flags:64\}\);/g,'await deferPrivate(i);');
 source=source.replace(/await i\.reply\(/g,'await respondPrivate(i,');
 if(source.includes("i.customId==='vex:roles:select'")&&!source.includes('checkComponentAccess'))source=source.replace('const m=await i.guild.members.fetch({user:i.user.id,force:true});',"const m=await i.guild.members.fetch({user:i.user.id,force:true});if(i.customId==='vex:roles:select'){const {checkComponentAccess}=await import('./interaction-response.js');await checkComponentAccess(i,m,'roles');}");
 if(early&&!source.includes('VEX_EARLY_ACK'))source=source.replace('if(i.isChatInputCommand()){','if(i.isChatInputCommand()){\n  /* VEX_EARLY_ACK */ await deferPrivate(i);');
 // Ticket commands open a panel, not a modal; they can be deferred safely.
 source=source.replace('if(ticketCommand){await checkOpen(i);','if(ticketCommand){await deferPrivate(i);await checkOpen(i);');
 return source;
}
export function integrateDashboard(source) {
 const header="import {organizedNavigation,dashboardRoute,commandDirectory,coreRows} from './core-ui.js';";
 if(!source.includes(header))source=header+'\n'+source;
 source=source.replace('[...communityRows,...vipRows,...welcomeRows]','[...communityRows,...vipRows,...welcomeRows,...coreRows]');
 source=source.replace('for(const [heading,items] of groups)','for(const [heading,items] of organizedNavigation(groups))');
 source=source.replace("page==='commands'||page==='community:utility'","page==='community:utility'");
 if(!source.includes('commandDirectory({h,raw,data,'))source=source.replace("else if(page==='community')", "else if(page==='commands')commandDirectory({h,raw,data,button,navigate,renderRules:(root,names,title)=>commandsUI({h,raw,data,patch,mark,names,title})(root)},root);else if(page==='community')");
 if(!source.includes("commands:['Command center'"))source=source.replace('const titles={',"const titles={commands:['Command center','Every command, its workflow and its settings.'],");
 // Read a deep link only on the first successful server load.
 if(!source.includes('VEX_ROUTE_INIT'))source=source.replace("data=next;data.preferences", "data=next;/* VEX_ROUTE_INIT */ if(!selected)page=dashboardRoute(new URLSearchParams(location.search).get('section'),data);data.preferences");
 source=source.replace('const scope=page.startsWith',"const scope=page==='commands'?'moderation':page.startsWith");
 // Keep zero numeric settings visible, including unlimited voice limits.
 return source;
}
export function installCommandRuntime() {
 const edit=(file,transform)=>{const p=path.join(root,'..',file),before=fs.readFileSync(p,'utf8'),after=transform(before);if(after!==before)fs.writeFileSync(p,after);};
 for(const file of ['src/bot.js','src/community.js','src/extra-commands.js','src/tickets.js'])edit(file,s=>integrateResponses(s,{early:file==='src/bot.js'}));
 edit('src/commands.js',s=>s.includes("from './command-spec.js'")?s:"import {vexCommand} from './command-spec.js';\n"+s+"\nif(!commands.some(c=>c.name==='vex'))commands.push(vexCommand);\nfor(const c of commands){c.contexts=[0];c.dm_permission=false;}\n");
 edit('src/command-policy.js',s=>s.replace(/\['help','commands'\]/g,"['help','commands','vex']"));
 edit('public/app.js',integrateDashboard);
 edit('public/community-ui.js',s=>s.replace("value:value||''","value:value??''"));
 edit('public/index.html',s=>s.includes('/core.css')?s:s.replace('</head>','<link rel="stylesheet" href="/core.css?v=4.0.0"></head>'));
 console.log('VEX Command Core installed after hosting source overrides.');
}
