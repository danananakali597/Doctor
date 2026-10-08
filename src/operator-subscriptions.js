import {db,plan} from './db.js';
// Read-only inventory for the Discord application owner. Access is not proof of payment.
export function operatorSubscriptions(client){
 const entitlements=new Map(db.prepare('SELECT guild,plan,expires FROM entitlements').all().map(r=>[r.guild,r]));
 const ids=new Set([...client.guilds.cache.keys(),...entitlements.keys()]);const result=[];
 const activity=new Map(db.prepare('SELECT guild,MAX(at) AS lastAt,COUNT(*) AS recordedEvents FROM incidents GROUP BY guild').all().map(r=>[r.guild,r]));
 const gift=db.prepare('SELECT redeemed_at FROM gift_keys WHERE guild=? AND plan=? AND entitlement_expires=? AND redeemed_at IS NOT NULL ORDER BY redeemed_at DESC LIMIT 1');
 for(const id of ids){const g=client.guilds.cache.get(id),stored=entitlements.get(id),effective=plan(id),giftRecord=stored&&gift.get(id,stored.plan,stored.expires);result.push({id,name:g?.name||null,installed:!!g,available:!!g&&g.available!==false,ownerId:g?.ownerId||null,members:g?.memberCount??null,channels:g?.channels?.cache?.size??null,roles:g?.roles?.cache?.size??null,lastEventAt:activity.get(id)?.lastAt||null,recordedEvents:activity.get(id)?.recordedEvents||0,plan:effective,previousPlan:stored?.plan||null,expires:stored&&['plus','ultimate'].includes(stored.plan)?stored.expires:null,status:effective==='basic'?(stored&&['plus','ultimate'].includes(stored.plan)?'expired':'free'):'active',source:giftRecord?'gift':stored&&['plus','ultimate'].includes(stored.plan)?'manual':'free',activatedAt:giftRecord?.redeemed_at||null});}
 return result.sort((a,b)=>(b.plan!=='basic')-(a.plan!=='basic')||(a.name||a.id).localeCompare(b.name||b.id));
}
