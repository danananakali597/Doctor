import {mergeCommunity} from './community-catalog.js';
import {mergeLogs} from './log-catalog.js';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {env} from './config.js';
import {defaults} from './catalog.js';
fs.mkdirSync(env.dataDir,{recursive:true,mode:0o700});
export const db=new Database(path.join(env.dataDir,'vex.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS config(guild TEXT PRIMARY KEY,json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS entitlements(guild TEXT PRIMARY KEY,plan TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS incidents(id INTEGER PRIMARY KEY,guild TEXT NOT NULL,kind TEXT NOT NULL,json TEXT NOT NULL,at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS incident_guild ON incidents(guild,id);
CREATE TABLE IF NOT EXISTS state(guild TEXT NOT NULL,key TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(guild,key));
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,json TEXT NOT NULL,expires INTEGER NOT NULL);`);
export function settings(g){const base=defaults(),r=db.prepare('SELECT json FROM config WHERE guild=?').get(g);if(!r)return base;const x=JSON.parse(r.json);return {...base,...x,community:mergeCommunity(base.community,x.community),activityLogs:mergeLogs(base.activityLogs,x.activityLogs),commandRules:x.commandRules||{},modules:Object.fromEntries(Object.keys(base.modules).map(k=>[k,{...base.modules[k],...x.modules?.[k]}]))};}
export function saveSettings(g,p){const old=settings(g),s={...old,...p,community:mergeCommunity(old.community,p.community),activityLogs:mergeLogs(old.activityLogs,p.activityLogs),commandRules:{...old.commandRules},modules:{...old.modules}};for(const[k,v]of Object.entries(p.modules||{}))s.modules[k]={...s.modules[k],...v};for(const[k,v]of Object.entries(p.commandRules||{}))s.commandRules[k]={...s.commandRules[k],...v};db.prepare('INSERT INTO config VALUES (?,?) ON CONFLICT(guild) DO UPDATE SET json=excluded.json').run(g,JSON.stringify(s));return s;}
export function plan(g){const r=db.prepare('SELECT * FROM entitlements WHERE guild=?').get(g);return r&&r.expires>Date.now()?r.plan:'basic';}
export function grant(g,p,expires){if(!['basic','plus','ultimate'].includes(p)||!Number.isSafeInteger(expires))throw Error('Invalid grant');db.prepare('INSERT INTO entitlements VALUES (?,?,?) ON CONFLICT(guild) DO UPDATE SET plan=excluded.plan,expires=excluded.expires').run(g,p,expires);}
export function event(g,kind,detail){db.prepare('INSERT INTO incidents(guild,kind,json,at) VALUES(?,?,?,?)').run(g,kind,JSON.stringify(detail),Date.now());db.prepare('DELETE FROM incidents WHERE guild=? AND id NOT IN (SELECT id FROM incidents WHERE guild=? ORDER BY id DESC LIMIT 1000)').run(g,g);}
export function events(g,limit=100){return db.prepare('SELECT * FROM incidents WHERE guild=? ORDER BY id DESC LIMIT ?').all(g,Math.min(1000,limit)).map(x=>({id:x.id,kind:x.kind,detail:JSON.parse(x.json),at:x.at}));}
export function getState(g,k,fallback=null){const r=db.prepare('SELECT json FROM state WHERE guild=? AND key=?').get(g,k);return r?JSON.parse(r.json):fallback;}
export function setState(g,k,v){db.prepare('INSERT INTO state VALUES (?,?,?) ON CONFLICT(guild,key) DO UPDATE SET json=excluded.json').run(g,k,JSON.stringify(v));}
export function setSession(id,value,expires){db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(id,JSON.stringify(value),expires);}
export function getSession(id){const r=db.prepare('SELECT * FROM sessions WHERE id=? AND expires>?').get(id||'',Date.now());return r?JSON.parse(r.json):null;}
export function deleteSession(id){db.prepare('DELETE FROM sessions WHERE id=?').run(id||'');}
