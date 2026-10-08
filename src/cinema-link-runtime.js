import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
export function integrateCinemaWeb(source){
 if(source.includes('/* VEX_CINEMA_LINKS */'))return source;
 const anchor=/app\.use\(express\.json\(\{limit:'128kb'\}\)\);/;
 const creation=/((?:export )?const app=express\(\);)/;
 if(!anchor.test(source)||!creation.test(source))throw Error('Cinema link integration: application or JSON middleware unavailable');
 // Legacy resolver routes can be attached before the main JSON middleware.
 // Normalize query strings immediately; normalize session bodies after parsing.
 return "import {cinemaLinkMiddleware} from './cinema-links.js';\n"+source.replace(creation,s=>s+'\n/* VEX_CINEMA_LINKS */ app.use(cinemaLinkMiddleware);').replace(anchor,s=>s+'\napp.use(cinemaLinkMiddleware);');
}
export function integrateCinemaPlayer(source){
 if(source.includes('/* VEX_CINEMA_FALLBACK */'))return source;
 if(!source.includes('async function kcLoadMovieServers(movieUrl)'))return source;
 const anchor='bar.append(label,select,retry);';
 if(!source.includes(anchor))throw Error('Cinema link integration: player controls unavailable');
 source=source.replace(anchor,"/* VEX_CINEMA_FALLBACK */ const official=document.createElement('button');official.type='button';official.className='control';official.textContent='Open Kurd Cinema';official.addEventListener('click',()=>openKurdCinemaOfficial(movieUrl));bar.append(label,select,retry,official);");
 // A cross-origin provider cannot report its current playback time to VEX.
 source=source.replace("const pos=expectedPosition(session);$('timeNow').textContent=fmt(pos);","const pos=expectedPosition(session);$('timeNow').textContent=playerMode==='provider'?'—':fmt(pos);");
 source=source.replace("$('trackFill').style.width=width+'%';","$('trackFill').style.width=(playerMode==='provider'?0:width)+'%';");
 return source;
}
export function installCinemaLinks(){
 const web=path.join(root,'src/web.js');fs.writeFileSync(web,integrateCinemaWeb(fs.readFileSync(web,'utf8')));
 const dir=path.join(root,'public/activity');if(!fs.existsSync(dir))return;
 for(const name of fs.readdirSync(dir).filter(n=>/^app(?:-v\d+)?\.js$/.test(n))){const file=path.join(dir,name),before=fs.readFileSync(file,'utf8'),after=integrateCinemaPlayer(before);if(before!==after)fs.writeFileSync(file,after);}
}
