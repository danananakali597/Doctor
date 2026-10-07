import {db,plan} from './db.js';
import {retireLegacyTrials} from './subscription-isolation.js';
export function auditSubscriptionIsolation(){
 const retired=retireLegacyTrials(db);
 const rows=db.prepare("SELECT guild,plan,expires FROM entitlements WHERE expires>? AND plan IN ('plus','ultimate') ORDER BY guild").all(Date.now());
 const checks={retiredTrials:retired.length,retiredPlansAreBasic:retired.every(g=>plan(g)==='basic'),unknownGuildIsBasic:plan('123456789012345679')==='basic',activeSubscriptions:rows.map(r=>({...r,effective:plan(r.guild),giftBacked:!!db.prepare('SELECT 1 FROM gift_keys WHERE guild=? AND plan=? AND entitlement_expires=? AND redeemed_at IS NOT NULL').get(r.guild,r.plan,r.expires)}))};
 console.log('VEX_SUBSCRIPTION_ISOLATION',JSON.stringify(checks));
}
