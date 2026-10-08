import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeCinemaLink,cinemaLinkMiddleware} from '../src/cinema-links.js';
import {integrateCinemaWeb,integrateCinemaPlayer} from '../src/cinema-link-runtime.js';
test('public movie detail links become canonical online links',()=>{
 for(const host of ['kurdcinama.com','www.kurdcinema.com'])assert.equal(normalizeCinemaLink('https://'+host+'/moves-details.aspx?movieid=19756#watch'),'https://kurdcinama.com/online.aspx?movieid=19756');
 assert.equal(normalizeCinemaLink('https://kurdcinama.com/online.aspx?movieid=19756'),'https://kurdcinama.com/online.aspx?movieid=19756');
});
test('unrelated domains, credentials, ports and ambiguous identifiers are untouched',()=>{
 for(const value of ['http://kurdcinama.com/online.aspx?movieid=1','https://kurdcinama.com.evil.test/online.aspx?movieid=1','https://evil.kurdcinama.com/online.aspx?movieid=1','https://user@kurdcinama.com/online.aspx?movieid=1','https://kurdcinama.com:8443/online.aspx?movieid=1','https://kurdcinama.com/online.aspx?movieid=1&movieid=2','https://kurdcinama.com/online.aspx?movieid=oops','https://kurdcinama.com/contact.aspx?movieid=1',undefined])assert.equal(normalizeCinemaLink(value),value);
});
test('middleware normalizes resolver and session inputs without changing permissions or server choice',()=>{
 const link='https://kurdcinama.com/moves-details.aspx?movieid=19756';const req={url:'/activity/api/kc/server?'+new URLSearchParams({url:link,serverId:'77511'})};let calls=0;
 cinemaLinkMiddleware(req,{},()=>calls++);const u=new URL(req.url,'https://vex.invalid');assert.equal(u.searchParams.get('serverId'),'77511');assert.equal(u.searchParams.get('url'),normalizeCinemaLink(link));assert.equal(calls,1);
 const body={mediaUrl:link,guild_id:'guild',instance_id:'instance'};cinemaLinkMiddleware({url:'/activity/api/session/claim',body},{},()=>{});assert.equal(body.mediaUrl,normalizeCinemaLink(link));assert.equal(body.guild_id,'guild');
 const unrelated={url:'/auth/login?url='+encodeURIComponent(link)};const before=unrelated.url;cinemaLinkMiddleware(unrelated,{},()=>{});assert.equal(unrelated.url,before);
});
test('runtime normalizes queries before legacy routes and bodies after JSON parsing',()=>{
 const s=fs.readFileSync(new URL('../src/web.js',import.meta.url),'utf8'),patched=integrateCinemaWeb(s);assert.equal(integrateCinemaWeb(patched),patched);assert.ok(patched.indexOf('app.use(cinemaLinkMiddleware)')<patched.indexOf('app.use(express.json'));assert.ok(patched.lastIndexOf('app.use(cinemaLinkMiddleware)')>patched.indexOf('app.use(express.json'));assert.throws(()=>integrateCinemaWeb('wrong runtime'));
});
test('cached query objects used by legacy Express routes are normalized',()=>{
 const link='https://kurdcinama.com/moves-details.aspx?movieid=19756',query={url:link,serverId:'77511'},req={url:'/activity/api/kc/server?'+new URLSearchParams(query),query};cinemaLinkMiddleware(req,{},()=>{});assert.equal(query.url,normalizeCinemaLink(link));assert.equal(query.serverId,'77511');
});
test('player gains an official fallback without claiming synchronization',()=>{
 const s="async function kcLoadMovieServers(movieUrl){bar.append(label,select,retry);const pos=expectedPosition(session);$('timeNow').textContent=fmt(pos);$('trackFill').style.width=width+'%';}";
 const patched=integrateCinemaPlayer(s);assert.equal(integrateCinemaPlayer(patched),patched);assert.match(patched,/openKurdCinemaOfficial\(movieUrl\)/);assert.match(patched,/playerMode==='provider'\?'—'/);assert.equal(integrateCinemaPlayer('unrelated app'),'unrelated app');
});
