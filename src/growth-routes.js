import {settings,plan,getState,event} from './db.js';
import {planSummary,hasFeature} from './plan-catalog.js';
import {setupDiagnostics,setupPatch} from './setup-diagnostics.js';
import {incidentList,triageIncident} from './incident-center.js';
import {automationRules,saveAutomations,setBackupSchedule} from './automations.js';
import {backup,restore} from './operations.js';
import {backupVersions} from './backup-history.js';
import {saveVersion,canEdit} from './workspace.js';
export function attachGrowthRoutes(app,{auth,csrf,guildAuth}){
 const owner=(req,res,next)=>req.member.id===req.guild.ownerId?next():res.status(403).json({error:'Server owner required'});
 app.get('/api/guilds/:id/workspace',auth,guildAuth,(req,res)=>res.json({plans:['basic','plus','ultimate'].map(planSummary),current:planSummary(plan(req.guild.id)),diagnostics:setupDiagnostics(req.guild),automations:automationRules(req.guild.id),backups:backupVersions(req.guild.id),schedule:getState(req.guild.id,'backup-schedule',{enabled:false,hours:24}),owner:req.member.id===req.guild.ownerId}));
 app.post('/api/guilds/:id/workspace/setup',auth,csrf,guildAuth,owner,(req,res)=>{const patch=setupPatch(req.guild,req.body);delete patch.community.welcome.introductionChannelId;saveVersion(req.guild.id,patch,req.member.id);event(req.guild.id,'setup_completed',{actor:req.member.id});res.json({ok:true,diagnostics:setupDiagnostics(req.guild)});});
 app.get('/api/guilds/:id/workspace/incidents',auth,guildAuth,(req,res)=>res.json({incidents:incidentList(req.guild,{query:req.query.query,status:req.query.status})}));
 app.post('/api/guilds/:id/workspace/incidents/:incident',auth,csrf,guildAuth,(req,res)=>{if(!canEdit(req.guild,req.member,'logs'))return res.status(403).json({error:'Log editing access required'});triageIncident(req.guild.id,Number(req.params.incident),req.body?.status,req.body?.note||'',req.member.id);event(req.guild.id,'incident_reviewed',{actor:req.member.id,incident:req.params.incident,status:req.body.status});res.json({ok:true});});
 app.put('/api/guilds/:id/workspace/automations',auth,csrf,guildAuth,owner,(req,res)=>{const rules=saveAutomations(req.guild,req.body?.rules,req.member.id);event(req.guild.id,'automation_settings_updated',{actor:req.member.id,count:rules.length});res.json({rules});});
 app.get('/api/guilds/:id/workspace/settings-export',auth,guildAuth,(req,res)=>res.attachment('vex-settings.json').json({guild:req.guild.id,exportedAt:new Date().toISOString(),settings:settings(req.guild.id)}));
 app.post('/api/guilds/:id/workspace/backups',auth,csrf,guildAuth,owner,async(req,res)=>{if(!hasFeature(plan(req.guild.id),'manualBackup'))return res.status(403).json({error:'Manual backups require Plus'});await backup(req.guild,req.member.id);res.json({backups:backupVersions(req.guild.id)});});
 app.post('/api/guilds/:id/workspace/backups/restore',auth,csrf,guildAuth,owner,async(req,res)=>{if(!hasFeature(plan(req.guild.id),'manualBackup'))return res.status(403).json({error:'Manual backups require Plus'});if(req.body?.confirm!==req.guild.name)throw Error('Type the server name to confirm');if(typeof req.body?.id!=='string'||!req.body.id)throw Error('Choose a backup version');res.json(await restore(req.guild,req.member.id,req.body.id));});
 app.put('/api/guilds/:id/workspace/backups/schedule',auth,csrf,guildAuth,owner,(req,res)=>res.json({schedule:setBackupSchedule(req.guild.id,req.body?.enabled,req.body?.hours,req.member.id)}));
}
