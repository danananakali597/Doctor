import {PermissionFlagsBits as P} from 'discord.js';
import {settings,events,event,plan} from './db.js';
import {validatePatch} from './catalog.js';
import {saveVersion,canEdit} from './workspace.js';
import {securitySuiteStatus,releaseSecurityTimeout} from './security-suite.js';
import {triageIncident} from './incident-center.js';
export function attachSecuritySuiteRoutes(app,{auth,csrf,guildAuth}){
 app.get('/api/guilds/:id/security-suite',auth,guildAuth,(req,res)=>res.json({status:securitySuiteStatus(req.guild.id),config:settings(req.guild.id).securitySuite,incidents:events(req.guild.id,1000).filter(e=>/violation|incident|protection|risk|raid|nuke/.test(e.kind)).slice(0,100)}));
 app.put('/api/guilds/:id/security-suite',auth,csrf,guildAuth,(req,res)=>{
  if(req.member.id!==req.guild.ownerId||!canEdit(req.guild,req.member,'protection'))return res.status(403).json({error:'Server owner required'});
  const patch=validatePatch({securitySuite:req.body},plan(req.guild.id),true);saveVersion(req.guild.id,patch,req.member.id);event(req.guild.id,'security_configuration_changed',{actor:req.member.id,modules:'security suite',result:'updated'});res.json({status:securitySuiteStatus(req.guild.id),config:settings(req.guild.id).securitySuite});
 });
 app.post('/api/guilds/:id/security-suite/incidents/:incident',auth,csrf,guildAuth,async(req,res)=>{
  if(!canEdit(req.guild,req.member,'logs'))return res.status(403).json({error:'Log editing access required'});
  const id=Number(req.params.incident),{action,note=''}=req.body||{};
  if(!Number.isSafeInteger(id)||id<1||typeof note!=='string'||note.length>1000)throw Error('Invalid incident review');
  if(action==='release-timeout'){
   if(!canEdit(req.guild,req.member,'moderation')||!req.member.permissions.has(P.ModerateMembers))return res.status(403).json({error:'Moderate Members required'});
   if(req.body.confirm!==req.guild.name)throw Error('Type the server name to confirm');await releaseSecurityTimeout(req.guild,id,req.member);
  }else if(!['investigating','resolved','false-positive'].includes(action))throw Error('Invalid incident action');
  triageIncident(req.guild.id,id,action==='investigating'?'investigating':'resolved',action==='false-positive'?'False positive: '+note:note,req.member.id);
  event(req.guild.id,'incident_reviewed',{actor:req.member.id,incident:id,result:action,note});res.json({ok:true});
 });
}
