import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {Window} from 'happy-dom';
import {securitySuiteUI} from '../public/security-suite-ui.js';
import {securitySuiteDefaults} from '../src/security-suite-config.js';
import {integrateSecurityDashboard,integrateSecurityEngine,integrateSecurityDatabase,integrateSecurityCatalog,integrateSecurityWeb,integrateSecurityBot,integrateSecurityCommands} from '../src/security-suite-runtime.js';
const w=new Window();globalThis.Node=w.Node;globalThis.document=w.document;
const h=(tag,p={},...children)=>{const el=w.document.createElement(tag);for(const [k,v]of Object.entries(p)){if(k.startsWith('on'))el.addEventListener(k.slice(2).toLowerCase(),v);else if(['checked','disabled','selected'].includes(k))el[k]=v;else el.setAttribute(k,String(v));}for(const c of children.flat(Infinity))if(c!=null)el.append(c instanceof w.Node?c:String(c));return el;};
const raw=s=>w.document.createTextNode(String(s));
function render(owner=true,plan='ultimate'){
 const root=h('div');w.document.body.append(root);const suite=securitySuiteDefaults(),changes=[];
 const ctx={h,raw,t:s=>s,data:{guild:{owner},plan,permissions:['protection','logs','moderation'],modules:[],settings:{modules:{}}},selected:'123456789012345678',api:async()=>({status:{mode:'monitor',configured:false,available:true,aiEnabled:false,budget:{usedMicros:0,limitMicros:5000000,period:'2026-10'}},incidents:[]}),toast:()=>{},dirty:()=>false,navigate:()=>{},showModule:()=>{},showAccess:()=>{},showResponse:()=>{},showMonitoring:()=>{},suite,change:(k,v)=>changes.push([k,v]),refresh:()=>{}};
 securitySuiteUI(root,ctx);root.querySelector('[role=tab]').click();return {root,changes,suite};
}
test('owner mode changes use shared settings staging; monitor and enforce remain distinct',()=>{
 const {root,changes}=render();const select=root.querySelector('select');select.value='monitor';select.dispatchEvent(new w.Event('change'));assert.deepEqual(changes[0],['mode','monitor']);assert.ok(root.querySelector('[role=tablist]'));assert.equal(root.querySelectorAll('[role=tab]').length,7);
});
test('AI budget and privacy controls are editable only by an eligible server owner',()=>{
 for(const [owner,tier,disabled]of [[true,'ultimate',false],[false,'ultimate',true],[true,'basic',true]]){
 const {root}=render(owner,tier);[...root.querySelectorAll('[role=tab]')].find(x=>x.textContent==='AI & budget').click();assert.ok(root.querySelectorAll('input').length>=8);for(const el of root.querySelectorAll('input,select,textarea'))assert.equal(el.disabled,disabled);
 } 
});
test('runtime integrations survive repeated boot installs and legacy navigation variants',()=>{
 for(const [file,fn]of [['src/db.js',integrateSecurityDatabase],['src/catalog.js',integrateSecurityCatalog],['src/security.js',integrateSecurityEngine],['src/web.js',integrateSecurityWeb],['src/bot.js',integrateSecurityBot],['src/commands.js',integrateSecurityCommands],['public/app.js',integrateSecurityDashboard]]){const source=fs.readFileSync(file,'utf8'),once=fn(source);assert.equal(fn(once),once,file);}
 let source=fs.readFileSync('public/app.js','utf8').replace("['security-center','◈','AI Security'],",'');source=source.replace("['PROTECTION',[...sections.slice(1,2)]]","['PROTECTION',[...sections.slice(1,2),['ai-security','✧','AI Security']]]");assert.ok(integrateSecurityDashboard(source).includes("['security-center','◈','AI Security']"));
});
test.after(()=>w.happyDOM.abort());
