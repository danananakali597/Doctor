import {plan} from './db.js';
import {localeFor} from './product-localization.js';
import {translateSystem} from '../public/product-locales.js';
import {planLimits,hasFeature,logTier,planOrder} from './plan-catalog.js';
import {logById} from './log-catalog.js';
export function requireFeature(g,f){if(!hasFeature(plan(g),f))throw Error('This feature requires '+({aiChat:'Ultimate',aiSecurity:'Ultimate',ticketTransfer:'Plus',manualBackup:'Plus',automations:'Plus',scheduledBackup:'Ultimate'}[f]||'a higher plan')+' access.');}
export function validateFeaturePatch(g,p){const tier=plan(g),l=planLimits(tier);
 for(const [id,key,max]of [['selfroles','roleIds',l.roleChoices],['responder','rules',l.responders],['levels','rewards',l.rewards],['welcome','fields',l.welcomeFields],['welcome','buttons',l.welcomeButtons],['notifications','feeds',l.feeds]])if(Array.isArray(p.community?.[id]?.[key])&&p.community[id][key].length>max)throw Error(`${tier.toUpperCase()} allows ${max} ${id} ${key}. Upgrade your plan for more.`);
 for(const [id,r]of Object.entries(p.activityLogs||{})){const spec=logById[id];if(spec&&r.enabled===true&&planOrder.indexOf(tier)<planOrder.indexOf(logTier(spec)))throw Error('Advanced log events require Plus access.');}
 return p;
}
export function featureForInteraction(i){if(i.commandName==='ask'||/^vex:(?:ai|ask|chat)(?::|$)/i.test(i.customId||''))return 'aiChat';if(i.commandName==='ai-security'||/^(?:vex:)?(?:security[-_:]ai|ai[-_:]security)/i.test(i.customId||''))return 'aiSecurity';if(/^vex:ticket:(?:transfer|assign)/.test(i.customId||''))return 'ticketTransfer';return null;}
const attached=new WeakSet();
export function attachFeatureGate(client){if(attached.has(client))return;attached.add(client);const original=client.emit.bind(client);client.emit=function(name,...args){const i=args[0];if(name!=='interactionCreate'||!i?.guildId)return original(name,...args);const f=featureForInteraction(i);if(f&&!hasFeature(plan(i.guildId),f)){const text=translateSystem('This feature requires '+(f==='ticketTransfer'?'Plus':'Ultimate')+' access in this server.',localeFor(i));void(i.deferred||i.replied?i.editReply({content:text,embeds:[],components:[]}):i.reply({content:text,flags:64,allowedMentions:{parse:[]}})).catch(()=>{});return true;}return original(name,...args);};}
