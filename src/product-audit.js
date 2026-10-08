import fs from 'node:fs';
import {env} from './config.js';
import {plan} from './db.js';
import {hasFeature} from './plan-catalog.js';
export function attachProductAudit(client){client.once('clientReady',()=>{const timer=setTimeout(async()=>{try{
 const origin='http://127.0.0.1:'+env.port,guild=client.guilds.cache.first()?.id||'123456789012345678';
 const protectedPaths=['/workspace','/workspace/incidents','/workspace/settings-export'];const anonymous=await Promise.all(protectedPaths.map(async p=>(await fetch(origin+'/api/guilds/'+guild+p)).status===401));
 const assets=await Promise.all(['/product-workspace.js','/product-locales.js'].map(async p=>(await fetch(origin+p)).status===200));
 const aiFiles=fs.readdirSync('src').filter(f=>/^(?:ai|security-ai)[-.].*\.js$/.test(f));
 const checks={aiExclusive:['basic','plus'].every(p=>!hasFeature(p,'aiChat')&&!hasFeature(p,'aiSecurity'))&&hasFeature('ultimate','aiChat')&&hasFeature('ultimate','aiSecurity'),aiRuntimeGated:!process.env.VEX_AI_PLUS_INSTALL_SOURCE||aiFiles.some(f=>fs.readFileSync('src/'+f,'utf8').includes('VEX_AI_PLAN_SHIM')),anonymousProtected:anonymous.every(Boolean),workspaceAssets:assets.every(Boolean),writeGate:fs.readFileSync('src/db.js','utf8').includes('VEX_FEATURE_WRITE_GATE'),backupVersionLock:fs.readFileSync('src/operations.js','utf8').includes('VEX_VERSION_RESTORE'),aiHttpGate:fs.readFileSync('src/web.js','utf8').includes('VEX_AI_ULTIMATE_GATE')};
 console.log('VEX_PRODUCT_AUDIT',JSON.stringify({version:5,passed:Object.values(checks).every(Boolean),...checks,guildPlans:[...client.guilds.cache.values()].map(g=>({guild:g.id,plan:plan(g.id)}))}));
 }catch(e){console.warn('VEX_PRODUCT_AUDIT_FAILED',e.code||e.name);}},14000);timer.unref();});}
