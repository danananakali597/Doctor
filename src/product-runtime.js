import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const prefix=(s,header)=>s.includes(header)?s:header+'\n'+s;
const edit=(f,fn)=>{const file=path.join(root,f),s=fs.readFileSync(file,'utf8'),next=fn(s);if(next!==s)fs.writeFileSync(file,next);};
export function integrateProductDatabase(s){
 s=prefix(s,"import {emitDomainEvent} from './domain-events.js';");s=prefix(s,"import {planLimits} from './plan-catalog.js';");s=prefix(s,"import {validateFeaturePatch} from './feature-policy.js';");
 if(!s.includes('VEX_FEATURE_WRITE_GATE'))s=s.replace(/export function saveSettings\(g,p\)\s*\{/,"export function saveSettings(g,p){ /* VEX_FEATURE_WRITE_GATE */ validateFeaturePatch(g,p);");
 if(!s.includes('VEX_DOMAIN_EVENTS'))s=s.replace("Date.now());db.prepare('DELETE FROM incidents", "Date.now()); /* VEX_DOMAIN_EVENTS */ emitDomainEvent(g,kind,detail,Number(db.prepare('SELECT last_insert_rowid() AS id').get().id));db.prepare('DELETE FROM incidents");
 s=s.replace(/LIMIT 1000\)'\)\.run\(g,g\)/g,"LIMIT ?)').run(g,g,planLimits(plan(g)).events)");
 s=s.replace(/Math\.min\(1000,limit\)/g,'Math.min(planLimits(plan(g)).events,Math.max(1,Number(limit)||100))');
 if(!s.includes('VEX_FEATURE_WRITE_GATE')||!s.includes('VEX_DOMAIN_EVENTS'))throw Error('Product database integration point unavailable');return s;
}
export function integrateProductWeb(s,aiPaths=[]){
 s=prefix(s,"import {attachGrowthRoutes} from './growth-routes.js';");s=prefix(s,"import {planSummary,hasFeature} from './plan-catalog.js';");
 if(!s.includes('attachGrowthRoutes(app,'))s=s.replace('app.use(express.static(',"attachGrowthRoutes(app,{auth,csrf,guildAuth});\napp.use(express.static(");
 // This middleware is registered before every legacy AI route. Read-only status
 // remains available; all provider/configuration actions require Ultimate.
 if(!s.includes('VEX_AI_ULTIMATE_GATE')){
 const paths=JSON.stringify(aiPaths);s=s.replace("app.use(express.json({limit:'128kb'}));",()=>`app.use(express.json({limit:'128kb'}));\n/* VEX_AI_ULTIMATE_GATE */ app.use((req,res,next)=>{const m=req.path.match(/^\\/api\\/guilds\\/(\\d{17,22})\\/(.*)$/);if(m&&(/(?:^|\\/)(?:ai|ai-chat|ai-security|security-ai|ask)(?:\\/|$)/.test(m[2])||${paths}.some(p=>new RegExp('^'+p.replace(/:[a-zA-Z]+/g,'[^/]+')+'$').test(req.path)))&&req.method!=='GET')return auth(req,res,()=>{if(!hasFeature(plan(m[1]),'aiChat'))return res.status(403).json({error:'This feature requires Ultimate access in this server.'});next();});next();});`);
 }
 if(!s.includes('VEX_AI_ULTIMATE_GATE')||!s.includes('attachGrowthRoutes(app,'))throw Error('Product web integration point unavailable');return s;
}
export function integrateProductDashboard(s){
 s=prefix(s,"import {operatorWorkspace} from './operator-workspace.js';");
 s=prefix(s,"import {productWorkspace} from './product-workspace.js';");s=prefix(s,"import {productRows} from './product-locales.js';");
 if(!s.includes('of productRows)'))s=s.replace('const raw=',"for(const [en,ar,ckb,tr]of productRows)translations[en]={ar,ckb,tr};\nconst raw=");
 if(!s.includes('VEX_OPERATOR_WORKSPACE'))s=s.replace('function navigation(){',"/* VEX_OPERATOR_WORKSPACE */ function navigation(){").replace('of organizedNavigation(groups)',"of organizedNavigation(me?.operator?[...groups,['VEX OWNER',[['operator','♙','VEX management']]]]:groups)").replace('const titles={',"const titles={operator:['VEX management','Your private keys and server access inventory.'],").replace("else if(page==='commands')","else if(page==='operator')operatorWorkspace(root,{h,raw,api,toast,t,operator:me.operator,date,guildId:selected,refresh:()=>load(selected,true)});else if(page==='commands')");
 if(!s.includes('VEX_OPERATOR_RENDER'))s=s.replace('function render(){if(!data)return;',"function render(){ /* VEX_OPERATOR_RENDER */ if(page==='operator'){navigation();$('workspace').hidden=false;$('empty').hidden=true;$('pageTitle').textContent=t('VEX management');$('pageDescription').textContent=t('Your private keys and server access inventory.');$('breadcrumb').textContent=t('VEX management');$('eyebrow').textContent='VEX';$('planTag').textContent='VEX';operatorWorkspace($('view'),{h,raw,api,toast,t,operator:me.operator,date,guildId:selected,refresh:()=>load(selected,true)});return;}if(!data)return;").replace("else{$('empty').hidden=false;busy(false);}","else{if(me.operator&&new URLSearchParams(location.search).get('section')==='operator'){page='operator';render();}else $('empty').hidden=false;busy(false);}");
 if(!s.includes('VEX_PRODUCT_TITLES'))s=s.replace('const titles={',"/* VEX_PRODUCT_TITLES */ const titles={setup:['Setup assistant','Review existing destinations and check VEX permissions.'],incidents:['Incident center','Review and resolve recorded incidents.'],automations:['Automations','Create owner-approved rules.'],backups:['Manual backups','Keep versions of the server structure.'],");
 if(!s.includes('VEX_PRODUCT_PAGES'))s=s.replace('function render(){',"/* VEX_PRODUCT_PAGES */ const productContext=section=>({h,raw,api,toast,t,data,selected,section,date,operator:me.operator,refresh:async()=>{data=await api('/api/guilds/'+selected);}});\nfunction render(){").replace("else if(page==='community')", "else if(['setup','incidents','automations','backups'].includes(page))productWorkspace(root,productContext(page));else if(page==='community')");
 if(!s.includes('VEX_PRODUCT_PLANS'))s=s.replace('function plans(root){',"function plans(root){ /* VEX_PRODUCT_PLANS */ const cards=h('div'),gifts=h('div');root.append(cards,gifts);productWorkspace(cards,productContext('plans'));giftKeysUI(gifts,{h,button,api,toast,t,guildId:selected,operator:me.operator,date,refresh:()=>load(selected,true)});return;");
 return s;
}
export function installProductRuntime(){
 const files=fs.readdirSync(path.join(root,'src')).filter(f=>f.endsWith('.js')&&/ai/i.test(f)&&!['tier-branding.js','tier-branding-profiles.js'].includes(f));
 const aiPaths=[];
 // Collect route names, never source or secrets, for a fail-closed provider gate.
 let aiPlanGates=0;
 for(const f of files){const file=path.join(root,'src',f);let s=fs.readFileSync(file,'utf8');for(const m of s.matchAll(/\b(?:app|router)\.(?:post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g))if(m[1].startsWith('/api/guilds/'))aiPaths.push(m[1]);
  if(/^(?:ai|security-ai)[-.]/.test(f)&&!s.includes('VEX_AI_PLAN_SHIM'))s=s.replace(/import\s*\{([^}]+)\}\s*from\s*['"]\.\/db\.js['"];?/g,(whole,bindings)=>{const item=bindings.split(',').find(x=>/^\s*plan(?:\s+as\s+\w+)?\s*$/.test(x));if(!item)return whole;const name=item.trim().split(/\s+as\s+/)[1]||'plan';aiPlanGates++;return whole.replace(item,'plan as productRawAIPlan')+`\n/* VEX_AI_PLAN_SHIM */ const ${name}=g=>productRawAIPlan(g)==='ultimate'?'ultimate':'basic';`;});
  if(s.includes('VEX_AI_PLAN_SHIM'))fs.writeFileSync(file,s.replace(/\bPlus\b/g,'Ultimate'));
 }
 edit('src/db.js',integrateProductDatabase);edit('src/web.js',s=>integrateProductWeb(s,aiPaths));edit('public/app.js',integrateProductDashboard);
 edit('src/catalog.js',s=>s.includes('VEX_PRODUCT_TIERS')?s:s+"\n// VEX_PRODUCT_TIERS\nfor(const m of modules){if(['scanner','score'].includes(m.id))m.tier='basic';if(m.id==='backup')m.tier='plus';if(/(?:^|[ _-])ai(?:$|[ _-])/i.test(m.id+' '+m.name))m.tier='ultimate';}\n");
 edit('src/community.js',s=>{s=prefix(s,"import {effectiveCommunity} from './plan-catalog.js';");s=prefix(s,"import {plan as productPlan} from './db.js';");return s.replace(/export const community=g=>settings\(g\)\.community;/,"export const community=g=>effectiveCommunity(settings(g).community,productPlan(g));");});
 edit('src/notifications.js',s=>{s=prefix(s,"import {plan as notificationPlan} from './db.js';");s=prefix(s,"import {effectiveCommunity} from './plan-catalog.js';");return s.replace('const cfg=settings(g.id).community.notifications;','const cfg=effectiveCommunity(settings(g.id).community,notificationPlan(g.id)).notifications;');});
 edit('src/logs.js',s=>{s=prefix(s,"import {plan as activityPlan} from './db.js';");s=prefix(s,"import {logTier,planOrder} from './plan-catalog.js';");return s.replace('export function logSetting(guildId,id){const rule=',"export function logSetting(guildId,id){if(!logById[id]||planOrder.indexOf(activityPlan(guildId))<planOrder.indexOf(logTier(logById[id])))return null;const rule=");});
 edit('src/operations.js',s=>{s=prefix(s,"import {captureBackup,selectBackup,persistRestoreMap} from './backup-history.js';");if(!s.includes('captureBackup(g.id,snapshot,actor)'))s=s.replace("setState(g.id,'backup',snapshot);","setState(g.id,'backup',snapshot);captureBackup(g.id,snapshot,actor);");
 if(!s.includes('VEX_VERSION_RESTORE'))s=s.replace('export async function restore(g,actor){','export async function restore(g,actor,versionId){ /* VEX_VERSION_RESTORE */').replace("const snap=getState(g.id,'backup');if(!snap||snap.guild!==g.id)throw Error('No backup for this server');\n await g.roles.fetch();","if(versionId)selectBackup(g.id,versionId);try{\n const snap=getState(g.id,'backup');if(!snap||snap.guild!==g.id)throw Error('No backup for this server');\n await g.roles.fetch();").replace("Existing resources, messages, member roles and settings were not overwritten.'};\n });}","Existing resources, messages, member roles and settings were not overwritten.'};\n }finally{if(versionId)persistRestoreMap(g.id,versionId);}\n });}");return s;});
 for(const f of ['src/db.js','src/web.js','src/catalog.js','src/community.js','src/notifications.js','src/logs.js','src/operations.js','public/app.js',...files.map(f=>'src/'+f)])execFileSync(process.execPath,['--check',path.join(root,f)],{stdio:'inherit'});
 console.log('VEX_PRODUCT_RUNTIME_INSTALLED',JSON.stringify({version:5,aiTier:'ultimate',aiWriteRoutes:aiPaths.length,aiPlanGates}));
}
