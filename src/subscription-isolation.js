// Retire only the removed operator seven-day trials. Gift-backed and other
// paid periods are preserved; archived rows make this migration reversible.
export function retireLegacyTrials(db,now=Date.now()){
 db.exec(`CREATE TABLE IF NOT EXISTS retired_trial_entitlements (
 guild TEXT NOT NULL, plan TEXT NOT NULL, expires INTEGER NOT NULL,
 trial_event INTEGER NOT NULL, retired_at INTEGER NOT NULL,
 PRIMARY KEY(guild,expires)
 );`);
 return db.transaction(()=>{
  const rows=db.prepare("SELECT guild,plan,expires FROM entitlements WHERE plan IN ('plus','ultimate') AND expires>?").all(now);
  const retired=[];
  for(const row of rows){
   const gift=db.prepare('SELECT 1 FROM gift_keys WHERE guild=? AND plan=? AND entitlement_expires=? AND redeemed_at IS NOT NULL').get(row.guild,row.plan,row.expires);
   if(gift)continue;
   const trial=db.prepare("SELECT id,json,at FROM incidents WHERE guild=? AND kind='trial_granted' ORDER BY id DESC LIMIT 1").get(row.guild);
   if(!trial)continue;
   let detail;try{detail=JSON.parse(trial.json);}catch{continue;}
   if(detail.days!==7||detail.plan!==row.plan||Math.abs(row.expires-(trial.at+7*86400000))>5000)continue;
   db.prepare('INSERT OR IGNORE INTO retired_trial_entitlements VALUES (?,?,?,?,?)').run(row.guild,row.plan,row.expires,trial.id,now);
   const removed=db.prepare('DELETE FROM entitlements WHERE guild=? AND plan=? AND expires=?').run(row.guild,row.plan,row.expires);
   if(removed.changes)retired.push(row.guild);
  }
  return retired;
 })();
}
