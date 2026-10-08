import fs from 'node:fs';
import crypto from 'node:crypto';
const names={basic:'VEX Basic',plus:'VEX Plus',ultimate:'VEX Ultimate'};
const profiles=new Map();
export const tierNickname=tier=>names[tier]||names.basic;
export function tierBrandingProfile(tier){
 tier=Object.hasOwn(names,tier)?tier:'basic';
 if(!profiles.has(tier)){
  const asset=`vex-${tier}-v1.png`,bytes=fs.readFileSync(new URL(`../public/assets/branding/${asset}`,import.meta.url));
  if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.length>8*1024*1024)throw Error('Invalid VEX avatar asset');
  const revision=crypto.createHash('sha256').update(bytes).digest('hex');
  profiles.set(tier,Object.freeze({tier,nickname:names[tier],revision,asset,avatar:`data:image/png;base64,${bytes.toString('base64')}`}));
 }
 return profiles.get(tier);
}
