import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
export function integrateCinemaMediaWeb(source){
 if(source.includes('/* VEX_CINEMA_MEDIA */'))return source;
 const creation=/((?:export )?const app=express\(\);)/;
 if(!creation.test(source))throw Error('Cinema media integration: application unavailable');
 return "import {cinemaMediaMiddleware} from './cinema-media.js';\n"+source.replace(creation,s=>s+'\n/* VEX_CINEMA_MEDIA */ app.use(cinemaMediaMiddleware());');
}
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
export function integrateCinemaDashboard(source){
 if(source.includes('/* VEX_CINEMA_DASHBOARD */'))return source;
 const anchor="else if(page.startsWith('community:'))";
 if(!source.includes(anchor))throw Error('Cinema dashboard integration: community routing unavailable');
 return "import {cinemaDashboard} from './cinema-dashboard.js';\n"+source.replace(anchor,"/* VEX_CINEMA_DASHBOARD */ else if(page==='community:cinema'){ $('pageTitle').textContent=t('Cinema');$('pageDescription').textContent=t('Choose a movie. Watch together in Discord.');$('breadcrumb').textContent=t('Cinema');cinemaDashboard(root,{h,raw,t,api,data,commandPanel:(panel,names,title)=>commandsUI({h,raw,data,patch,mark,names,title})(panel)});} "+anchor);
}
export function integrateCinemaMappedPlayer(source){
 if(source.includes('/* VEX_CINEMA_MAPPED_PROVIDER */'))return source;
 if(!source.includes('async function kcLoadMovieServers(movieUrl)'))return source;
 if(!source.includes('frame.src=d.embedUrl;'))throw Error('Cinema provider integration: iframe source unavailable');
 source="/* VEX_CINEMA_MAPPED_PROVIDER */ import {configureCinemaFrame,cinemaDiscordHost} from './cinema-provider.js';\n"+source.replace('frame.src=d.embedUrl;', 'configureCinemaFrame(frame,d.embedUrl,location.hostname);');
 source=source.replace("const chosen=(data.servers||[]).find(x=>x.selected)","const chosen=(location.hostname===cinemaDiscordHost?(data.servers||[]).find(x=>/vidmoly/i.test(x.label||'')):null)||(data.servers||[]).find(x=>x.selected)");
 source=source.replace('if(chosen)await loadServer(chosen.id);','if(chosen){select.value=String(chosen.id);await loadServer(chosen.id);}');
 return source;
}
export function integrateCinemaDirectPlayer(source){
 if(source.includes('/* VEX_CINEMA_DIRECT_MEDIA */'))return source;
 if(!source.includes('async function kcLoadMovieServers(movieUrl)'))return source;
 const start="try{const d=await kcJson('/kc/server?url='";
 const begin=source.indexOf(start),end=source.indexOf('}catch(e){',begin);
 if(begin<0||end<0)throw Error('Cinema direct player integration: server loader unavailable');
 const replacement="try{const d=await kcJson('/kc/media?url='+encodeURIComponent(movieUrl)+(id?'&serverId='+encodeURIComponent(id):''));if(seq!==kcRequestSeq||request!==kcServerSeq)return;if(d.serverId)select.value=String(d.serverId);cinemaMediaCleanup?.();cinemaMediaCleanup=null;stage.replaceChildren();const video=document.createElement('video');video.className='kc-direct-video';video.style.cssText='width:100%;height:100%;object-fit:contain';video.addEventListener('loadedmetadata',()=>{notice('');applyPlayback(session,true);});video.addEventListener('error',()=>notice('The video source could not be played. Choose another server.'));stage.append(video);const dispose=await attachCinemaMedia(video,{format:d.format,url:activityStreamUrl(d.streamPath,apiRoot)},{onError:notice});if(seq!==kcRequestSeq||request!==kcServerSeq){dispose();return;}cinemaMediaCleanup=dispose;player=video;playerMode='video';notice('Video source found. Loading playback…');";
 source=source.slice(0,begin)+replacement+source.slice(end);
 source=source.replace('function cancelKc(){','function cancelKc(){cinemaMediaCleanup?.();cinemaMediaCleanup=null;');
 source=source.replace("const chosen=(location.hostname===cinemaDiscordHost?(data.servers||[]).find(x=>/vidmoly/i.test(x.label||'')):null)||(data.servers||[]).find(x=>x.selected)","const chosen=(data.servers||[]).find(x=>x.selected)");
 source=source.replace('await loadServer(chosen.id);','await loadServer();');
 // Stop an earlier player before a server switch starts its asynchronous lookup.
 source=source.replace('const request=++kcServerSeq;',"const request=++kcServerSeq;cinemaMediaCleanup?.();cinemaMediaCleanup=null;player=null;playerMode='';");
 return "/* VEX_CINEMA_DIRECT_MEDIA */ import {attachCinemaMedia,activityStreamUrl} from './cinema-media-player.js?v=1';\nlet cinemaMediaCleanup=null;\n"+source;
}
export function installCinemaLinks(){
 const web=path.join(root,'src/web.js');fs.writeFileSync(web,integrateCinemaMediaWeb(integrateCinemaWeb(fs.readFileSync(web,'utf8'))));
 const dashboard=path.join(root,'public/app.js');fs.writeFileSync(dashboard,integrateCinemaDashboard(fs.readFileSync(dashboard,'utf8')));
 const dir=path.join(root,'public/activity');if(!fs.existsSync(dir))return;
 fs.copyFileSync(path.join(root,'public/cinema-provider.js'),path.join(dir,'cinema-provider.js'));
 fs.copyFileSync(path.join(root,'public/cinema-media-player.js'),path.join(dir,'cinema-media-player.js'));
 fs.copyFileSync(path.join(root,'node_modules/hls.js/dist/hls.mjs'),path.join(dir,'hls.mjs'));
 for(const name of fs.readdirSync(dir).filter(n=>/^app(?:-v\d+)?\.js$/.test(n))){const file=path.join(dir,name),before=fs.readFileSync(file,'utf8'),after=integrateCinemaDirectPlayer(integrateCinemaMappedPlayer(integrateCinemaPlayer(before)));if(before!==after)fs.writeFileSync(file,after);}
 const index=path.join(dir,'index.html');if(fs.existsSync(index)){const html=fs.readFileSync(index,'utf8');const next=html.replace(/(src=['"]\.\/)(app(?:-v\d+)?\.js)(?:\?[^'"]*)?(['"])/g,(match,prefix,name,quote)=>{let file=path.join(dir,name);if(!fs.existsSync(file)){if(!fs.existsSync(path.join(dir,'app.js')))return match;name='app.js';file=path.join(dir,name);}return prefix+name+'?v='+crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0,12)+quote;});fs.writeFileSync(index,next);}
}
