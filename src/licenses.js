import crypto from 'node:crypto';
import {db,grant} from './db.js';
import {nextMonthlyPeriodEnd} from './billing-period.js';

db.exec(`CREATE TABLE IF NOT EXISTS gift_keys (
 id TEXT PRIMARY KEY, hash TEXT UNIQUE NOT NULL, plan TEXT NOT NULL,
 created_by TEXT NOT NULL, created_at INTEGER NOT NULL,
 revoked_at INTEGER, redeemed_at INTEGER, redeemed_by TEXT,
 guild TEXT, entitlement_expires INTEGER
);`);
const digest=key=>crypto.createHash('sha256').update(key).digest('hex');
const metadata=row=>({id:row.id,plan:row.plan,createdAt:row.created_at,
 status:row.redeemed_at!==null?'redeemed':row.revoked_at!==null?'revoked':'unused',
 redeemedAt:row.redeemed_at,redeemedBy:row.redeemed_by,guild:row.guild,expires:row.entitlement_expires});
export function createGiftKey(tier,actor){
 if(!['plus','ultimate'].includes(tier))throw Error('Choose Plus or Ultimate');
 const key='VEX-'+crypto.randomBytes(24).toString('hex').toUpperCase(),id=crypto.randomUUID(),now=Date.now();
 db.prepare('INSERT INTO gift_keys (id,hash,plan,created_by,created_at) VALUES (?,?,?,?,?)').run(id,digest(key),tier,actor,now);
 return {key,...metadata(db.prepare('SELECT * FROM gift_keys WHERE id=?').get(id))};
}
export function listGiftKeys(){return db.prepare('SELECT * FROM gift_keys ORDER BY created_at DESC,rowid DESC LIMIT 200').all().map(metadata);}
export function revokeGiftKey(id){
 const result=db.prepare('UPDATE gift_keys SET revoked_at=? WHERE id=? AND revoked_at IS NULL AND redeemed_at IS NULL').run(Date.now(),id);
 if(!result.changes)throw Error('Only unused keys can be revoked');
}
export const redeemGiftKey=db.transaction((input,guild,actor)=>{
 if(typeof input!=='string'||!/^VEX-[A-F0-9]{48}$/.test(input.trim().toUpperCase()))throw Error('Invalid or unavailable key');
 const now=Date.now(),row=db.prepare('SELECT * FROM gift_keys WHERE hash=?').get(digest(input.trim().toUpperCase()));
 if(!row||row.revoked_at!==null||row.redeemed_at!==null)throw Error('Invalid or unavailable key');
 const current=db.prepare('SELECT * FROM entitlements WHERE guild=?').get(guild);
 const active=current&&current.expires>now&&['plus','ultimate'].includes(current.plan);
 if(active&&current.plan==='ultimate'&&row.plan==='plus')throw Error('Activate a lower plan after your current plan expires');
 // Upgrade immediately. Preserve the unused Plus value as Ultimate time ($7/$14).
 const upgraded=!!(active&&current.plan==='plus'&&row.plan==='ultimate');
 const credit=upgraded?Math.floor((current.expires-now)/2):0;
 const expires=upgraded?nextMonthlyPeriodEnd(now)+credit:nextMonthlyPeriodEnd(active?current.expires:now);
 const result=db.prepare('UPDATE gift_keys SET redeemed_at=?,redeemed_by=?,guild=?,entitlement_expires=? WHERE id=? AND redeemed_at IS NULL AND revoked_at IS NULL').run(now,actor,guild,expires,row.id);
 if(!result.changes)throw Error('Invalid or unavailable key');
 grant(guild,row.plan,expires);
 return upgraded?{plan:row.plan,expires,upgraded,creditMilliseconds:credit}:{plan:row.plan,expires};
});
