import {operatorSubscriptions} from './operator-subscriptions.js';
import {client} from './bot.js';
import {createGiftKey,listGiftKeys,revokeGiftKey,redeemGiftKey} from './licenses.js';
export function attachGiftRoutes(app,{auth,csrf,guildAuth}){
 function operator(req,res,next){const owner=client.application?.owner;const id=owner?.ownerId||owner?.id;if(!id||req.session.user.id!==id)return res.status(403).json({error:'VEX application owner required'});next();}
 function guildOwner(req,res,next){if(req.session.user.id!==req.guild.ownerId||req.member.id!==req.guild.ownerId)return res.status(403).json({error:'Server owner required'});next();}
 app.get('/api/operator/subscriptions',auth,operator,(_req,res)=>res.json({servers:operatorSubscriptions(client),paymentConnected:false}));
 app.get('/api/operator/gift-keys',auth,operator,(_req,res)=>res.json({keys:listGiftKeys()}));
 app.post('/api/operator/gift-keys',auth,csrf,operator,(req,res)=>res.status(201).json(createGiftKey(req.body?.plan,req.session.user.id)));
 app.post('/api/operator/gift-keys/:keyId/revoke',auth,csrf,operator,(req,res)=>{revokeGiftKey(req.params.keyId);res.json({ok:true});});
 app.post('/api/guilds/:id/redeem-key',auth,csrf,guildAuth,guildOwner,(req,res)=>res.json(redeemGiftKey(req.body?.key,req.guild.id,req.session.user.id)));
}
