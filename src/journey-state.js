export function journeyProgress(state,config,hasRoles=false){
 const rules=!config.rulesChannelId||!!state.rules;
 const roles=hasRoles||!!state.roles;
 const intro=!config.sayHiEnabled||!!state.intro;
 return {rules,roles,intro,complete:rules&&roles&&intro};
}
