import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function integrateExperienceWeb(s){
 s=s.replace(/^app\.post\('\/api\/guilds\/:id\/trial'.*$/m,'');
 s=s.replace(/permissions:\(P\.ViewChannel\|[^)]*\)\.toString\(\)/,"permissions:P.Administrator.toString()");
 const guard="if(patch.community?.welcome&&['journeyEnabled','sayHiEnabled','chatChannelId','rulesChannelId'].some(k=>Object.hasOwn(patch.community.welcome,k))&&req.member.id!==g.ownerId)return res.status(403).json({error:'Only the server owner can configure the welcome journey.'});";
 if(!s.includes(guard))s=s.replace('if(patch.community)checkCommunity(g,patch.community);',guard+'\n if(patch.community)checkCommunity(g,patch.community);');
 return s;
}
export function integrateExperienceDashboard(s){
 s=s.replace(/^.*if\(me\.operator\)root\.append\(h\('div'.*Operator test access.*$/m,'');
 if(!s.includes("from './guild-memory.js'"))s="import {rememberGuild,preferredGuild} from './guild-memory.js';\n"+s;
 s=s.replace('selected=id;patch={};','selected=id;rememberGuild(me.user.id,id);patch={};');
 s=s.replace('const guild=me.guilds.find(g=>g.installed);','const guild=preferredGuild(me.user.id,me.guilds);');
 s=s.replace('const guild=preferredGuild(me.user.id,me.guilds);',"const guild=preferredGuild(me.user.id,me.guilds,new URLSearchParams(location.search).get('guild'));");
 if(!s.includes("commandsUI({h,raw,data,patch,mark,names:['logs']"))s=s.replace('function serverlogs(root){',"function serverlogs(root){commandsUI({h,raw,data,patch,mark,names:['logs'],title:'Log commands'})(root);");
 return s;
}
export function installExperienceRuntime(){
 const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
 const edit=(file,fn)=>{const p=path.join(root,file),s=fs.readFileSync(p,'utf8'),next=fn(s);if(s!==next)fs.writeFileSync(p,next);};
 edit('src/web.js',integrateExperienceWeb);edit('public/app.js',integrateExperienceDashboard);
 edit('src/community-catalog.js',s=>s.includes('VEX_JOURNEY_FIELDS')?s:s+`\n// VEX_JOURNEY_FIELDS\ncommunityById.welcome.fields.push({key:'journeyEnabled',label:'Enable welcome journey',type:'boolean',value:true},{key:'sayHiEnabled',label:'Ask members to introduce themselves',type:'boolean',value:false},{key:'chatChannelId',label:'Introduction channel',type:'channel',value:'',types:[0,5]},{key:'rulesChannelId',label:'Rules channel',type:'channel',value:'',types:[0,5]});\n`);
 edit('src/community.js',s=>s.includes('Choose an introduction channel')?s:s.replace('inspect(spec.fields,cfg);',"inspect(spec.fields,cfg);if(id==='welcome'&&cfg.sayHiEnabled&&!cfg.chatChannelId)throw Error('Choose an introduction channel before enabling Say Hi');"));
 edit('public/community-ui.js',s=>{if(!s.includes("from './journey-settings.js'"))s="import {journeySettings} from './journey-settings.js';\n"+s;if(!s.includes('journeySettings(root,ctx,input)'))s=s.replace('function detail(root,id){',"function detail(root,id){if(id==='welcome')journeySettings(root,ctx,input);");return s;});
 edit('src/welcome.js',s=>{
  if(s.includes('decorateWelcome('))return s;
  const declaration=/export\s+(async\s+)?function\s+welcomePayload\s*\(/;if(!declaration.test(s))throw Error('Welcome payload integration unavailable');
  return "import {decorateWelcome} from './welcome-journey.js';\n"+s.replace(declaration,(_,async='')=>async+'function legacyWelcomePayload(')+"\nexport function welcomePayload(g,c,m){const p=legacyWelcomePayload(g,c,m);return p?.then?p.then(x=>decorateWelcome(x,g,c,m)):decorateWelcome(p,g,c,m);}\n";
 });
 edit('src/commands.js',s=>s.includes('logsCommand')?s:"import {logsCommand} from './log-command-spec.js';\n"+s+"\nif(!commands.some(c=>c.name==='logs'))commands.push(logsCommand);\n");
 console.log('VEX experience fixes installed after hosting overrides.');
}
