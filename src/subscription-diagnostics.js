import {db,plan} from './db.js';
export function auditSubscriptionIsolation(){
 const tests=new Set((process.env.VEX_TEST_GUILD_IDS||'').split(/[\s,;]+/).filter(Boolean));
 const rows=db.prepare('SELECT guild,plan,expires FROM entitlements ORDER BY guild').all();
 const gifts=db.prepare('SELECT guild,plan,entitlement_expires AS expires FROM gift_keys WHERE redeemed_at IS NOT NULL').all();
 const trials=db.prepare("SELECT guild,at FROM incidents WHERE kind='trial_granted' ORDER BY at DESC").all();
 console.log('VEX_SUBSCRIPTION_DIAGNOSTIC',JSON.stringify({resolver:plan.toString().slice(0,1400),testGuildCount:tests.size,rows:rows.map(r=>({...r,effective:plan(r.guild),testListed:tests.has(r.guild),giftBacked:gifts.some(g=>g.guild===r.guild&&g.plan===r.plan&&g.expires===r.expires),lastTrial:trials.find(t=>t.guild===r.guild)?.at||null})),unknownGuildPlan:plan('123456789012345679')}));
}
