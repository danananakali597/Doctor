// Applied after sealed compatibility installers, before any runtime modules load.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const prefix=(s,line)=>s.includes(line)?s:line+'\n'+s;
const replace=(s,from,to)=>{if(!s.includes(from))throw Error('Security integration point unavailable: '+from.slice(0,70));return s.replace(from,to);};
export function integrateSecurityDatabase(s){
 s=prefix(s,"import {securitySuiteDefaults,mergeSecuritySuite} from './security-suite-config.js';");
 if(!s.includes('securitySuite:mergeSecuritySuite'))s=replace(s,'return {...base,...x,','return {...base,...x,securitySuite:mergeSecuritySuite(securitySuiteDefaults(),x.securitySuite),');
 if(!s.includes('securitySuite:mergeSecuritySuite(old'))s=replace(s,'s={...old,...p,','s={...old,...p,securitySuite:mergeSecuritySuite(old.securitySuite,p.securitySuite),');return s;
}
export function integrateSecurityCatalog(s){
 s=prefix(s,"import {securitySuiteDefaults,validateSecuritySuite} from './security-suite-config.js';");
 if(!s.includes('securitySuite:securitySuiteDefaults()'))s=replace(s,'return {community:','return {securitySuite:securitySuiteDefaults(),community:');
 if(!s.includes("k==='securitySuite'"))s=replace(s,"if(k==='logsChannelId')", "if(k==='securitySuite'){out.securitySuite=validateSecuritySuite(v,owner);if(out.securitySuite.ai?.enabled===true&&plan!=='ultimate')throw Error('AI Security requires Ultimate access');}\n  else if(k==='logsChannelId')");return s;
}
export function integrateSecurityEngine(s){
 s=prefix(s,"import {inspectSecurityAI,automatedResponses} from './security-suite.js';");
 if(!s.includes('VEX_SECURITY_UNIFIED_MODE'))s=replace(s,"export const active=(g,id,s=settings(g))=>entitled(plan(g),id)&&s.modules[id]?.enabled?s.modules[id]:null;", "/* VEX_SECURITY_UNIFIED_MODE */ export const active=(g,id,s=settings(g))=>{const c=entitled(plan(g),id)&&s.modules[id]?.enabled?s.modules[id]:null;if(!c)return null;if(s.securitySuite.mode==='paused'&&!['logs','joins','advancedLogs','owner','tamper','scanner','score'].includes(id))return null;return s.securitySuite.mode==='monitor'?{...c,action:'log'}:c;};");
 if(!s.includes('await inspectSecurityAI(m,s,record)')){
  s=replace(s,"if(!m.guild||m.author?.bot||!m.content)return;","if(!m.guild||m.author?.bot||(!m.content&&!m.attachments?.size))return;");
  s=replace(s,'if(!reasons.length)return;','if(!reasons.length){await inspectSecurityAI(m,s,record);return;}');
  s=replace(s,'config=s.modules[id];','config=enabled(id);');
  s=replace(s,"if(risk&&counts.hit", "if(automatedResponses(m.guildId)&&risk&&counts.hit");
  s=replace(s,"if(!actions.length)return;const order=", "if(!actions.length)return;if(!automatedResponses(g.id))for(const row of actions)row[1]={...row[1],action:'log'};const order=");
 }return s;
}
export function integrateSecurityWeb(s){
 s=prefix(s,"import {attachSecuritySuiteRoutes} from './security-suite-routes.js';");
 if(!s.includes('attachSecuritySuiteRoutes(app,'))s=replace(s,"app.get('/api/public'", "attachSecuritySuiteRoutes(app,{auth,csrf,guildAuth});\napp.get('/api/public'");return s;
}
export function integrateSecurityBot(s){
 s=prefix(s,"import {securitySuiteInteraction} from './security-suite-commands.js';");
 if(!s.includes('if(await securitySuiteInteraction(i))'))s=replace(s,'try{if(await communityInteraction(i))return;}', "try{if(await securitySuiteInteraction(i))return;}catch(e){await i.editReply({content:e.message,allowedMentions:{parse:[]}}).catch(()=>{});return;}\n try{if(await communityInteraction(i))return;}");return s;
}
export function integrateSecurityCommands(s){
 s=prefix(s,"import {securitySuiteCommand} from './security-suite-commands.js';");
 if(!s.includes("commands.some(c=>c.name==='vex-security')"))s=replace(s,'for(const c of commands)',"if(!commands.some(c=>c.name==='vex-security'))commands.push(securitySuiteCommand);\nfor(const c of commands)");return s;
}
export function integrateSecurityDashboard(s){
 s=prefix(s,"import {securitySuiteUI} from './security-suite-ui.js';");s=prefix(s,"import {securitySuiteRows} from './security-suite-locales.js';");
 if(!s.includes('...securitySuiteRows'))s=replace(s,'...giftRows]', '...giftRows,...securitySuiteRows]');
 if(!s.includes("['security-center','◈','AI Security']")){if(s.includes("['PROTECTION',sections.slice(1,2)]"))s=replace(s,"['PROTECTION',sections.slice(1,2)]", "['PROTECTION',[['security-center','◈','AI Security'],...sections.slice(1,2)]]");else s=replace(s,"['PROTECTION',[","['PROTECTION',[['security-center','◈','AI Security'],");}
 if(!s.includes("'security-center':['AI Security'"))s=replace(s,'const titles={',"const titles={'security-center':['AI Security','One place for protection, decisions and AI spending.'],");
 if(!s.includes("page==='security-center')securitySuiteUI"))s=replace(s,"else if(page==='commands')", "else if(page==='security-center')securitySuiteUI(root,{h,raw,t,data,selected,api,toast,dirty,navigate,refresh:()=>load(selected,true),showModule:detail,showAccess:access,showResponse:response,showMonitoring:monitoring,suite:{...data.settings.securitySuite,...patch.securitySuite,ai:{...data.settings.securitySuite.ai,...patch.securitySuite?.ai}},change:(key,v)=>{patch.securitySuite??={};if(key==='ai')patch.securitySuite.ai={...patch.securitySuite.ai,...v};else patch.securitySuite[key]=v;mark();}});else if(page==='commands')");
 if(!s.includes("page==='security-center'||page==='protection'||page.startsWith('module:')"))s=s.replace("page==='protection'||page.startsWith('module:')", "page==='security-center'||page==='protection'||page.startsWith('module:')");return s;
}
export function installSecuritySuite(){
 const transformations={'src/db.js':integrateSecurityDatabase,'src/catalog.js':integrateSecurityCatalog,'src/security.js':integrateSecurityEngine,'src/web.js':integrateSecurityWeb,'src/bot.js':integrateSecurityBot,'src/commands.js':integrateSecurityCommands,'public/app.js':integrateSecurityDashboard};
 for(const [name,fn]of Object.entries(transformations)){const file=path.join(root,name),original=fs.readFileSync(file,'utf8'),updated=fn(original);if(original!==updated)fs.writeFileSync(file,updated);}
 console.log('VEX_SECURITY_SUITE_INSTALLED',JSON.stringify({version:1,defaultProvider:'omni-moderation-latest',paidReview:'opt-in'}));
}
