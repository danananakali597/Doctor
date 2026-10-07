import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import {PermissionFlagsBits as P,Collection} from 'discord.js';
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'vex-http-'));process.env.PUBLIC_URL='http://localhost:3000';process.env.DISCORD_CLIENT_ID='123456789012345678';
const {app}=await import('../src/web.js');const {client}=await import('../src/bot.js');const {setSession,grant,settings,db}=await import('../src/db.js');
const id='123456789012345678',sid='session-test',csrf='csrf-test';let permission=P.ManageGuild;
const member={id:'user',permissions:{has:p=>(permission&p)===p},roles:{cache:new Collection()}};
const guild={id,name:'Test',ownerId:'owner',members:{fetch:async()=>member},channels:{cache:new Collection()},roles:{cache:new Collection()}};client.guilds.cache.set(id,guild);
setSession(crypto.createHash('sha256').update(sid).digest('hex'),{user:{id:'user',username:'test'},csrf,guilds:[]},Date.now()+60000);
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
const headers={cookie:'sid='+sid,origin:'http://localhost:3000','x-csrf-token':csrf,'content-type':'application/json'};
const put=(body,extra={})=>fetch(base+'/api/guilds/'+id+'/settings',{method:'PUT',headers:{...headers,...extra},body:JSON.stringify(body)});
test('anonymous settings writes are rejected',async()=>assert.equal((await put({}, {cookie:''})).status,401));
test('CSRF rejects cross-origin writes',async()=>assert.equal((await put({},{origin:'https://evil.example'})).status,403));
test('Manage Server alone cannot weaken protection',async()=>assert.equal((await put({modules:{spam:{enabled:true}}})).status,403));
test('fresh Discord permissions are checked for every request',async()=>{permission=0n;assert.equal((await put({})).status,403);permission=P.ManageGuild|P.Administrator;});
test('forged premium settings rejected even for administrator',async()=>{const r=await put({modules:{nuke:{enabled:true}}});assert.equal(r.status,400);assert.equal(settings(id).modules.nuke.enabled,false);});
test('administrator can save permitted Basic settings',async()=>{assert.equal((await put({modules:{spam:{enabled:true,action:'log'}}})).status,200);assert.equal(settings(id).modules.spam.enabled,true);});
test('administrator cannot add trusted users without ownership',async()=>{grant(id,'plus',Date.now()+60000);assert.equal((await put({trustedUsers:['123456789012345679']})).status,400);});
test('guild lookup cannot access another server',async()=>{const r=await fetch(base+'/api/guilds/223456789012345678',{headers});assert.equal(r.status,403);});
test('non-operator cannot mint a trial',async()=>{const r=await fetch(base+'/api/guilds/'+id+'/trial',{method:'POST',headers,body:JSON.stringify({plan:'ultimate'})});assert.equal(r.status,403);});
test('gift creation and metadata stay private to the application owner; redemption requires guild ownership',async()=>{
 client.application={owner:{id:'app-owner'}};
 grant(id,'basic',Date.now());
 const request=(url,method='GET',body,custom=headers)=>fetch(base+url,{method,headers:custom,...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await request('/api/operator/gift-keys')).status,403);
 assert.equal((await request('/api/operator/gift-keys','POST',{plan:'plus'})).status,403);
 assert.equal((await request('/api/operator/gift-keys/fake/revoke','POST',{})).status,403);
 const operatorSid='operator-session';setSession(crypto.createHash('sha256').update(operatorSid).digest('hex'),{user:{id:'app-owner'},csrf,guilds:[]},Date.now()+60000);
 const operatorHeaders={...headers,cookie:'sid='+operatorSid};
 assert.equal((await request('/api/operator/gift-keys','POST',{plan:'plus'},{...operatorHeaders,origin:'https://evil.example'})).status,403);
 const created=await request('/api/operator/gift-keys','POST',{plan:'ultimate'},operatorHeaders);assert.equal(created.status,201);const key=await created.json();
 const listing=await (await request('/api/operator/gift-keys','GET',null,operatorHeaders)).json();assert.equal(JSON.stringify(listing).includes(key.key),false);
 assert.equal((await request('/api/guilds/'+id+'/redeem-key','POST',{key:key.key})).status,403);
 const ownerSid='guild-owner-session';setSession(crypto.createHash('sha256').update(ownerSid).digest('hex'),{user:{id:'owner'},csrf,guilds:[]},Date.now()+60000);
 const ownerHeaders={...headers,cookie:'sid='+ownerSid};member.id='owner';
 try{const redeemed=await request('/api/guilds/'+id+'/redeem-key','POST',{key:key.key},ownerHeaders);assert.equal(redeemed.status,200);assert.equal((await redeemed.json()).plan,'ultimate');
 assert.equal((await request('/api/guilds/'+id+'/redeem-key','POST',{key:key.key},ownerHeaders)).status,400);
 }finally{member.id='user';grant(id,'basic',Date.now());}
});
test('removed cinema and watch routes stay unavailable',async()=>{
 for(const url of ['/api/cinema/'+id,'/cinema/'+id,'/watch','/api/watch/example','/activity/','/activity/api/room']){const r=await fetch(base+url,{headers});assert.equal(r.status,404,url);}
});
test('enabled logs require an accessible same-server channel and sending permissions',async()=>{
 permission=P.ManageGuild|P.Administrator;
 const channelId='323456789012345678';const body={activityLogs:{role_created:{enabled:true,channelId,color:'#aa00ff'}}};
 assert.equal((await put(body)).status,400);
 let allowed=false;guild.members.me={id:'bot'};guild.channels.cache.set(channelId,{id:channelId,type:0,permissionsFor:()=>({has:()=>allowed})});
 assert.equal((await put(body)).status,400);allowed=true;assert.equal((await put(body)).status,200);
 assert.equal(settings(id).activityLogs.role_created.color,'#3498db');
 assert.equal((await put({activityLogs:{role_created:{channelId:''}}})).status,400);
});
test('dashboard scope limits are enforced on writes and publishing',async()=>{
 const {setState}=await import('../src/db.js');permission=P.ManageGuild|P.Administrator;
 setState(id,'dashboard_access',{user:['logs']});
 assert.equal((await put({community:{welcome:{title:'Denied'}}})).status,403);
 assert.equal((await put({modules:{spam:{enabled:false}}})).status,403);
 const r=await fetch(base+'/api/guilds/'+id+'/community/action',{method:'POST',headers,body:JSON.stringify({action:'test-card',kind:'welcome'})});assert.equal(r.status,400);
 assert.equal((await put({restoreRevision:1,confirm:'Test'})).status,403);
 setState(id,'dashboard_access',{});
});
test('command controls reject forged names, foreign resources and unauthorized editors',async()=>{
 permission=P.ManageGuild|P.Administrator;
 assert.equal((await put({commandRules:{invented:{enabled:false}}})).status,400);
 assert.equal((await put({commandRules:{help:{enabled:false}}})).status,400);
 assert.equal((await put({commandRules:{rank:{allowedChannels:['923456789012345678']}}})).status,400);
 const channelId='423456789012345678';guild.channels.cache.set(channelId,{id:channelId,type:0});
 assert.equal((await put({commandRules:{rank:{enabled:false,allowedChannels:[channelId]}}})).status,200);
 assert.equal(settings(id).commandRules.rank.enabled,false);
 const {setState}=await import('../src/db.js');setState(id,'dashboard_access',{user:['community']});
 assert.equal((await put({commandRules:{rank:{enabled:true}}})).status,403);
 setState(id,'dashboard_access',{});
});
test('history restore rechecks ownership and current plan',async()=>{
 const {history,saveVersion}=await import('../src/workspace.js');
 saveVersion(id,{modules:{spam:{enabled:false}}},'owner');const row=history(id)[0];
 member.id='owner';permission=P.ManageGuild|P.Administrator;
 const r=await put({restoreRevision:row.id,confirm:'Test'});assert.equal(r.status,200);assert.equal(settings(id).modules.spam.enabled,true);
 assert.equal((await put({restoreRevision:row.id,confirm:'wrong'})).status,400);
 assert.equal((await put({restoreRevision:99999,confirm:'Test'})).status,404);member.id='user';
});
test.after(async()=>{await new Promise(r=>server.close(r));client.destroy();db.close();fs.rmSync(process.env.DATA_DIR,{recursive:true,force:true});});
