// Single version-controlled startup pipeline. Existing sealed integrations remain
// execution-only; no credential or installer source is exported or logged.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const stage=(name,fn)=>{fn();console.log('VEX_BOOTSTRAP_STAGE',JSON.stringify({name,ok:true}));};
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'vex-bootstrap-'));
function installer(key,base64=false){if(!process.env[key])return;const file=path.join(temp,key+'.cjs');fs.writeFileSync(file,base64?Buffer.from(process.env[key],'base64'):process.env[key],{mode:0o600});try{execFileSync(process.execPath,[file],{stdio:'inherit'});}finally{fs.rmSync(file,{force:true});}}
try{
 stage('cinema-compatibility',()=>{for(const key of ['CINEMA_PATCH_SOURCE','CINEMA_FULLSCREEN_PATCH_SOURCE','CINEMA_KC_SAFE_PATCH_SOURCE','CINEMA_KC_SERVER_PATCH_SOURCE','CINEMA_KC_UI_PATCH_SOURCE','CINEMA_STABILITY_PATCH_SOURCE'])if(process.env[key])new Function('fs',process.env[key])(fs);});
 stage('welcome-compatibility',()=>{for(const [key,file]of [['VEX_WELCOME_V4_SOURCE_B64','src/welcome.js'],['VEX_WELCOME_V4_CSS_B64','public/welcome-vex.css'],['VEX_WELCOME_V4_JS_B64','public/welcome-vex.js']])if(process.env[key])fs.writeFileSync(file,Buffer.from(process.env[key],'base64'));installer('VEX_WELCOME_V4_APPLY_B64',true);});
 stage('ai-compatibility',()=>installer('VEX_AI_PLUS_INSTALL_SOURCE'));
 stage('security-compatibility',()=>installer('VEX_SECURITY_SUITE_INSTALL_SOURCE'));
 for(const file of ['src/cinema-activity.js','src/web.js','src/community-catalog.js','src/community.js','src/bot.js','src/welcome.js','public/activity/app.js','public/community-ui.js','public/app.js','public/welcome-vex.js'])if(fs.existsSync(file))execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
 if(process.env.VEX_INVALID_BUTTON_EMOJI_RECOVERY_SOURCE){const {REST}=await import('discord.js');stage('discord-emoji-compatibility',()=>new Function('REST',process.env.VEX_INVALID_BUTTON_EMOJI_RECOVERY_SOURCE)(REST));}
 stage('discord-oauth-compatibility',()=>installer('VEX_DASHBOARD_CONNECTION_PATCH_SOURCE'));
 stage('advanced-security-compatibility',()=>installer('VEX_SECURITY_ADVANCED_INSTALL_SOURCE'));
 await import('../src/index.js');
 const files=fs.readdirSync('src').filter(f=>f.endsWith('.js')).map(f=>({path:'src/'+f,sha256:crypto.createHash('sha256').update(fs.readFileSync('src/'+f)).digest('hex')}));
 const directory=process.env.DATA_DIR||'./data';fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'runtime-manifest.json'),JSON.stringify({version:5,at:Date.now(),files},null,2),{mode:0o600});
 console.log('VEX_BOOTSTRAP_MANIFEST',JSON.stringify({version:5,files:files.length,source:'GitHub bootstrap with explicit compatibility stages'}));
 const {runCompatibilityAudits}=await import('../runtime-audits.mjs');await runCompatibilityAudits();
}finally{fs.rmSync(temp,{recursive:true,force:true});}
