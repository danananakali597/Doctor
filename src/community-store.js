import {db,event} from './db.js';
import crypto from 'node:crypto';
db.exec(`CREATE TABLE IF NOT EXISTS community_xp(guild TEXT,user TEXT,xp INTEGER NOT NULL DEFAULT 0,last INTEGER NOT NULL DEFAULT 0,hash TEXT,PRIMARY KEY(guild,user));
CREATE TABLE IF NOT EXISTS community_daily(guild TEXT,day TEXT,kind TEXT,count INTEGER DEFAULT 0,PRIMARY KEY(guild,day,kind));
CREATE TABLE IF NOT EXISTS mod_cases(id INTEGER PRIMARY KEY AUTOINCREMENT,guild TEXT,actor TEXT,target TEXT,action TEXT,reason TEXT,at INTEGER);
CREATE TABLE IF NOT EXISTS community_tickets(channel TEXT PRIMARY KEY,guild TEXT,user TEXT,status TEXT,claimed TEXT,created INTEGER);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_ticket ON community_tickets(guild,user) WHERE status='open';`);
export const level=xp=>Math.floor(Math.sqrt(xp/100));
export function awardXP(guild,user,content,amount,cooldown,now=Date.now()){
 const hash=crypto.createHash('sha256').update(content.trim().toLowerCase()).digest('hex');
 const awarded=db.transaction(()=>{const old=db.prepare('SELECT * FROM community_xp WHERE guild=? AND user=?').get(guild,user)||{xp:0,last:0,hash:''};if(now-old.last<cooldown*1000||hash===old.hash||content.trim().length<4)return null;
 const xp=old.xp+amount;db.prepare('INSERT INTO community_xp VALUES(?,?,?,?,?) ON CONFLICT(guild,user) DO UPDATE SET xp=excluded.xp,last=excluded.last,hash=excluded.hash').run(guild,user,xp,now,hash);return {xp,level:level(xp),previous:level(old.xp)};})();if(awarded&&awarded.level>awarded.previous)event(guild,'level_reached',{member:user,level:awarded.level,previous:awarded.previous});return awarded;
}
export function rank(guild,user){const r=db.prepare('SELECT xp FROM community_xp WHERE guild=? AND user=?').get(guild,user)||{xp:0};return {...r,level:level(r.xp),position:db.prepare('SELECT COUNT(*)+1 AS n FROM community_xp WHERE guild=? AND xp>?').get(guild,r.xp).n};}
export const leaderboard=g=>db.prepare('SELECT user,xp FROM community_xp WHERE guild=? ORDER BY xp DESC,user LIMIT 20').all(g).map(r=>({...r,level:level(r.xp)}));
export function count(g,kind){db.prepare('INSERT INTO community_daily VALUES(?,?,?,1) ON CONFLICT(guild,day,kind) DO UPDATE SET count=count+1').run(g,new Date().toISOString().slice(0,10),kind);db.prepare("DELETE FROM community_daily WHERE day < date('now','-90 days')").run();}
export const daily=g=>db.prepare("SELECT day,kind,count FROM community_daily WHERE guild=? AND day>=date('now','-30 days') ORDER BY day").all(g);
export function addCase(guild,actor,target,action,reason){const r=db.prepare('INSERT INTO mod_cases(guild,actor,target,action,reason,at) VALUES(?,?,?,?,?,?)').run(guild,actor,target,action,reason,Date.now());event(guild,'mod_'+action,{actor,target,caseId:r.lastInsertRowid});return Number(r.lastInsertRowid);}
export const cases=g=>db.prepare('SELECT * FROM mod_cases WHERE guild=? ORDER BY id DESC LIMIT 100').all(g);
export const tickets=g=>db.prepare('SELECT * FROM community_tickets WHERE guild=? ORDER BY created DESC LIMIT 100').all(g);
