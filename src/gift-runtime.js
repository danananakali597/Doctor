import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function integrateGiftWeb(source){
 const header="import {attachGiftRoutes} from './gift-routes.js';",call='attachGiftRoutes(app,{auth,csrf,guildAuth});';
 if(!source.includes(header))source=header+'\n'+source;
 if(!source.includes(call)){
  if(!source.includes('app.use(express.static('))throw Error('Gift keys could not locate web integration point');
  source=source.replace('app.use(express.static(',call+'\napp.use(express.static(');
 }
 if(!source.includes('operator:'))source=source.replace('res.json({user:req.session.user,csrf:',"res.json({operator:!!(client.application?.owner?.ownerId||client.application?.owner?.id)&&req.session.user.id===(client.application?.owner?.ownerId||client.application?.owner?.id),user:req.session.user,csrf:");
 return source;
}
export function integrateGiftDashboard(source){
 const header="import {giftKeysUI} from './gift-keys.js';",locale="import {giftRows} from './gift-locales.js';";
 if(!source.includes(header))source=header+'\n'+source;
 if(!source.includes(locale))source=locale+'\n'+source;
 if(!source.includes('...giftRows')&&!source.includes('of giftRows)'))source="for(const[en,ar,ckb,tr]of giftRows)translations[en]={ar,ckb,tr};\n"+source;
 if(!source.includes('giftKeysUI(root,')){
  if(!source.includes('function plans(root){'))throw Error('Gift keys could not locate Plans & access');
  source=source.replace('function plans(root){',"function plans(root){giftKeysUI(root,{h,button,api,toast,t,guildId:selected,operator:me.operator,date,refresh:()=>load(selected,true)});");
 }
 return source;
}
export function installGiftRuntime(){
 const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
 for(const[file,transform]of [['src/web.js',integrateGiftWeb],['public/app.js',integrateGiftDashboard]]){
  const filename=path.join(root,file),before=fs.readFileSync(filename,'utf8'),after=transform(before);
  if(before!==after)fs.writeFileSync(filename,after);
 }
 console.log('VEX private gift keys installed after hosting source overrides.');
}
