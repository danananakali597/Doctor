import {db} from './db.js';
import crypto from 'node:crypto';
// Integer microdollars, persistent UTC-month accounting, shared across all guilds.
db.exec(`CREATE TABLE IF NOT EXISTS security_ai_spend(scope TEXT NOT NULL,period TEXT NOT NULL,used INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(scope,period));
CREATE TABLE IF NOT EXISTS security_ai_daily(guild TEXT NOT NULL,day TEXT NOT NULL,reviews INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(guild,day));
CREATE TABLE IF NOT EXISTS security_ai_reservations(id TEXT PRIMARY KEY,guild TEXT NOT NULL,period TEXT NOT NULL,amount INTEGER NOT NULL,settled INTEGER NOT NULL DEFAULT 0);`);
export const month=()=>new Date().toISOString().slice(0,7);
const day=()=>new Date().toISOString().slice(0,10);
export function operatorBudgetMicros(){const n=Number(process.env.VEX_SECURITY_AI_MONTHLY_BUDGET_USD||0);return Number.isFinite(n)&&n>=0?Math.floor(n*1000000):0;}
const used=(scope,period=month())=>db.prepare('SELECT used FROM security_ai_spend WHERE scope=? AND period=?').get(scope,period)?.used||0;
export function budgetStatus(g,c){return {period:month(),usedMicros:used(g),limitMicros:c.monthlyBudgetCents*10000,globalRemainingMicros:Math.max(0,operatorBudgetMicros()-used('*')),dailyReviews:db.prepare('SELECT reviews FROM security_ai_daily WHERE guild=? AND day=?').get(g,day())?.reviews||0,dailyLimit:c.maxPaidReviewsPerDay};}
export function reserveReview(g,c,amount){return db.transaction(()=>{
 if(!Number.isSafeInteger(amount)||amount<=0)throw Error('Invalid AI reservation');
 const status=budgetStatus(g,c);if(status.usedMicros+amount>status.limitMicros||amount>status.globalRemainingMicros||status.dailyReviews>=status.dailyLimit)return null;
 const id=crypto.randomUUID(),period=month();for(const scope of [g,'*'])db.prepare('INSERT INTO security_ai_spend VALUES(?,?,?) ON CONFLICT(scope,period) DO UPDATE SET used=used+excluded.used').run(scope,period,amount);
 db.prepare('INSERT INTO security_ai_daily VALUES(?,?,1) ON CONFLICT(guild,day) DO UPDATE SET reviews=reviews+1').run(g,day());
 db.prepare('INSERT INTO security_ai_reservations VALUES(?,?,?,?,0)').run(id,g,period,amount);return {id,guild:g,period,amount};
 })();}
export function settleReview(reservation,actual){return db.transaction(()=>{
 const r=db.prepare('SELECT * FROM security_ai_reservations WHERE id=?').get(reservation.id);if(!r||r.settled)return;
 // Unknown outcome keeps the full reservation: a timed-out request may be billed.
 const billed=actual===null?r.amount:Math.max(0,Math.ceil(actual));
 for(const scope of [r.guild,'*'])db.prepare('UPDATE security_ai_spend SET used=MAX(0,used+?) WHERE scope=? AND period=?').run(billed-r.amount,scope,r.period);
 db.prepare('UPDATE security_ai_reservations SET settled=1 WHERE id=?').run(r.id);
 db.prepare('DELETE FROM security_ai_reservations WHERE settled=1 AND period<?').run(month());
 })();}
