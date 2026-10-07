import fs from 'node:fs';
import {env} from './config.js';
export function attachExperienceAudit(client){client.once('clientReady',()=>{const timer=setTimeout(async()=>{
 try{
  const origin='http://127.0.0.1:'+env.port;
  const publicResponse=await fetch(origin+'/api/public'),pub=await publicResponse.json();
  const app=fs.readFileSync('public/app.js','utf8'),web=fs.readFileSync('src/web.js','utf8'),welcome=fs.readFileSync('src/welcome.js','utf8'),community=fs.readFileSync('public/community-ui.js','utf8');
  const registered=await client.application.commands.fetch();
  const checks={administratorInvite:new URL(pub.invite).searchParams.get('permissions')==='8',trialRemoved:!web.includes("app.post('/api/guilds/:id/trial'")&&!app.includes('Operator test access'),guildMemory:app.includes('preferredGuild(me.user.id'),privateGifts:app.includes('giftKeysUI(root,'),welcomeRouting:welcome.includes('decorateWelcome('),journeySettings:community.includes('journeySettings(root,ctx,input)'),logsRegistered:registered.some(c=>c.name==='logs'),anonymousProtected:(await fetch(origin+'/api/me')).status===401};
  console.log('VEX_EXPERIENCE_AUDIT',JSON.stringify({passed:Object.values(checks).every(Boolean),...checks}));
 }catch(e){console.warn('VEX_EXPERIENCE_AUDIT_FAILED',e.code||e.name);}
 },6500);timer.unref();});}
