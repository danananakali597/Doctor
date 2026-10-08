import {db,events,plan} from './db.js';
import {planLimits,hasFeature} from './plan-catalog.js';
db.exec('CREATE TABLE IF NOT EXISTS incident_triage(guild TEXT NOT NULL,incident INTEGER NOT NULL,status TEXT NOT NULL,actor TEXT NOT NULL,note TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(guild,incident));');
const important=e=>/incident|violation|failed|protection|tamper|risk|raid|nuke|configuration_changed|bot_roles/.test(e.kind)&&!/^automation_/.test(e.kind);
export function incidentList(g,{query='',status='all'}={}){
 const tier=plan(g.id),cutoff=Date.now()-planLimits(tier).historyDays*86400000,list=events(g.id,planLimits(tier).events).filter(e=>e.at>=cutoff&&important(e)),q=String(query).toLowerCase().slice(0,100),actorFor=e=>e.detail.actor||e.detail.author||e.detail.member||e.detail.target;
 const byActor=new Map();if(hasFeature(tier,'incidentCorrelation'))for(const e of list){const actor=actorFor(e);if(actor){const rows=byActor.get(actor)||[];rows.push(e);byActor.set(actor,rows);}}
 const reviews=new Map(db.prepare('SELECT incident,status,actor,note,at FROM incident_triage WHERE guild=?').all(g.id).map(x=>[x.incident,x])),out=[];
 for(const e of list){const triage=reviews.get(e.id)||{status:'open'},actorId=actorFor(e),m=g.members?.cache?.get(actorId),u=m?.user,actor={id:actorId||null,name:m?.displayName||u?.username||actorId||'Unknown',avatar:u?.displayAvatarURL?.({size:64})||null};if(status!=='all'&&triage.status!==status||q&&!JSON.stringify([e.kind,e.detail,actor.name]).toLowerCase().includes(q))continue;
 const correlated=[];for(const x of byActor.get(actorId)||[]){if(x.id!==e.id&&Math.abs(x.at-e.at)<=600000)correlated.push(x.id);if(correlated.length===20)break;}out.push({...e,triage,actor,correlated});if(out.length===200)break;
 }return out;
}
export function triageIncident(g,id,status,note,actor){if(!Number.isSafeInteger(id)||!['open','investigating','resolved'].includes(status)||typeof note!=='string'||note.length>1000)throw Error('Invalid incident review');if(!db.prepare('SELECT id FROM incidents WHERE guild=? AND id=?').get(g,id))throw Error('Incident not found in this server');db.prepare('INSERT INTO incident_triage VALUES(?,?,?,?,?,?) ON CONFLICT(guild,incident) DO UPDATE SET status=excluded.status,actor=excluded.actor,note=excluded.note,at=excluded.at').run(g,id,status,actor,note,Date.now());db.prepare('DELETE FROM incident_triage WHERE NOT EXISTS (SELECT 1 FROM incidents WHERE incidents.guild=incident_triage.guild AND incidents.id=incident_triage.incident)').run();}
