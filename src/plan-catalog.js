export const planOrder=['basic','plus','ultimate'];
export const planPrices={basic:0,plus:7,ultimate:14};
export const featureTiers={core:'basic',moderation:'basic',welcome:'basic',roles:'basic',levels:'basic',tickets:'basic',voice:'basic',logs:'basic',diagnostics:'basic',configExport:'basic',advancedLogs:'plus',ticketTransfer:'plus',manualBackup:'plus',automations:'plus',analytics:'plus',incidentCenter:'basic',aiChat:'ultimate',aiSecurity:'ultimate',incidentCorrelation:'ultimate',scheduledBackup:'ultimate',advancedAutomations:'ultimate'};
export const limits={basic:{roleChoices:5,responders:3,rewards:1,welcomeFields:0,welcomeButtons:2,feeds:1,automationRules:0,backups:0,historyDays:7,events:500},plus:{roleChoices:20,responders:10,rewards:10,welcomeFields:3,welcomeButtons:5,feeds:5,automationRules:5,backups:3,historyDays:30,events:2000},ultimate:{roleChoices:20,responders:20,rewards:10,welcomeFields:6,welcomeButtons:5,feeds:12,automationRules:20,backups:30,historyDays:90,events:10000}};
export const normalizedPlan=p=>planOrder.includes(p)?p:'basic';
export const hasFeature=(p,f)=>Object.hasOwn(featureTiers,f)&&planOrder.indexOf(normalizedPlan(p))>=planOrder.indexOf(featureTiers[f]);
export const planLimits=p=>limits[normalizedPlan(p)];
export const basicLogGroups=['members','messages','moderation','voice'];
export const logTier=e=>basicLogGroups.includes(e.group)?'basic':'plus';
export function effectiveCommunity(c,p){const l=planLimits(p),out=structuredClone(c);for(const [id,key,max]of [['selfroles','roleIds',l.roleChoices],['responder','rules',l.responders],['levels','rewards',l.rewards],['welcome','fields',l.welcomeFields],['welcome','buttons',l.welcomeButtons],['notifications','feeds',l.feeds]])if(Array.isArray(out[id]?.[key]))out[id][key]=out[id][key].slice(0,max);return out;}
export const planSummary=p=>({plan:normalizedPlan(p),price:planPrices[normalizedPlan(p)],limits:planLimits(p),features:Object.fromEntries(Object.keys(featureTiers).map(f=>[f,hasFeature(p,f)])),minimums:featureTiers});
