import {wrapCommandInteraction,componentCount,presentCommand} from './command-presentation.js';
import {commandProfiles} from './command-profiles.js';
import {atlasInteraction,handlesAtlas} from './command-atlas.js';
import {reviewInteraction,handlesReview} from './command-review.js';
import {refreshCommandShowcase} from './command-showcase.js';
const attached=new WeakSet();
export function attachCommandExperience(client){
 if(attached.has(client))return;attached.add(client);
 const handles=i=>handlesAtlas(i)||handlesReview(i);
 for(const listener of client.listeners('interactionCreate')){
  client.removeListener('interactionCreate',listener);
  client.on('interactionCreate',function(i){if(!handles(i))return listener.call(this,i);});
 }
 client.on('interactionCreate',i=>{if(handles(i))void (handlesAtlas(i)?atlasInteraction(i):reviewInteraction(i)).catch(e=>console.warn('VEX_COMMAND_EXPERIENCE_HANDLER_FAILED',e.code||e.name));});
 // Wrapping is synchronous and runs before every handler, including installed AI/Cinema modules.
 client.prependListener('interactionCreate',wrapCommandInteraction);
 client.once('clientReady',()=>{const timer=setTimeout(async()=>{
  try{
   const registered=await client.application.commands.fetch();
   const names=registered.filter(c=>c.type===1).map(c=>c.name),missing=names.filter(n=>!commandProfiles[n]);
   const cards=names.map(n=>presentCommand({embeds:[{title:'Interface audit',description:'Design validation only; no action performed.'}]},n));
   const allNative=cards.every(p=>p.components?.[0]?.type===17&&componentCount(p.components)<=40);
   console.log('VEX_COMMAND_EXPERIENCE_AUDIT',JSON.stringify({passed:!missing.length&&allNative,count:names.length,profiles:Object.keys(commandProfiles).length,missing,allNative,names}));
   if(!missing.length&&allNative){try{console.log('VEX_COMMAND_SHOWCASE',JSON.stringify(await refreshCommandShowcase(client,registered)));}catch(e){console.warn('VEX_COMMAND_SHOWCASE_FAILED',e.code||e.name);}}
  }catch(e){console.warn('VEX_COMMAND_EXPERIENCE_AUDIT_FAILED',e.code||e.name);}
 },16000);timer.unref();});
 console.log('VEX Command Experience installed: distinct profiles, native cards, command atlas and reviewed changes.');
}
