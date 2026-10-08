import crypto from 'node:crypto';
import {db,plan,getState,setState} from './db.js';
import {planLimits} from './plan-catalog.js';
db.exec('CREATE TABLE IF NOT EXISTS backup_versions(id TEXT PRIMARY KEY,guild TEXT NOT NULL,at INTEGER NOT NULL,actor TEXT NOT NULL,snapshot TEXT NOT NULL,restore_map TEXT NOT NULL DEFAULT \'{}\'); CREATE INDEX IF NOT EXISTS backup_versions_guild ON backup_versions(guild,at);');
export function captureBackup(g,snapshot,actor){const id=crypto.randomUUID();db.prepare('INSERT INTO backup_versions(id,guild,at,actor,snapshot) VALUES(?,?,?,?,?)').run(id,g,Date.now(),String(actor||''),JSON.stringify(snapshot));db.prepare('DELETE FROM backup_versions WHERE guild=? AND id NOT IN (SELECT id FROM backup_versions WHERE guild=? ORDER BY at DESC,rowid DESC LIMIT ?)').run(g,g,Math.max(1,planLimits(plan(g)).backups));return id;}
export const backupVersions=g=>db.prepare('SELECT id,at,actor FROM backup_versions WHERE guild=? ORDER BY at DESC,rowid DESC LIMIT 30').all(g);
export function selectBackup(g,id){const r=db.prepare('SELECT * FROM backup_versions WHERE guild=? AND id=?').get(g,id);if(!r)throw Error('Backup not found in this server');setState(g,'backup',JSON.parse(r.snapshot));setState(g,'restoreMap',JSON.parse(r.restore_map));return r;}
export const persistRestoreMap=(g,id)=>db.prepare('UPDATE backup_versions SET restore_map=? WHERE guild=? AND id=?').run(JSON.stringify(getState(g,'restoreMap',{})),g,id);
