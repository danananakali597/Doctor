import https from 'node:https';
import {lookup as dnsLookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import crypto from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {normalizeCinemaLink} from './cinema-links.js';

const providerHosts=new Set(['vidmoly.org','www.vidmoly.org','hgcloud.to','voe.sx','morencius.com']);
const MAX_TEXT=1024*1024;
export function mediaError(code,message,status=422){return Object.assign(new Error(message),{code,status});}
export function publicMediaUrl(value,base){
 let url;try{url=new URL(value,base);}catch{throw mediaError('invalid_url','Invalid media address');}
 if(url.protocol!=='https:'||url.username||url.password||url.port||isIP(url.hostname)||!url.hostname.includes('.')||/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname))throw mediaError('unsafe_url','Unsupported media address');
 url.hash='';return url.href;
}
export function publicIPv4(address){
 if(isIP(address)!==4)return false;
 const [a,b,c]=address.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||a===100&&b>=64&&b<=127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===88&&c===99)||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
}
// Each socket connects to an inspected address. Redirects repeat validation;
// cookies, credentials and invented referrers are never forwarded.
export async function openPublicMedia(value,{headers={},signal,lookup=dnsLookup,request=https.request}={},depth=0){
 const href=publicMediaUrl(value),url=new URL(href);
 const addresses=await lookup(url.hostname,{family:4,all:true});
 if(!addresses.length||addresses.some(x=>!publicIPv4(x.address)))throw mediaError('unsafe_address','Media source resolved to an unsupported network');
 const address=addresses[0].address;
 const response=await new Promise((resolve,reject)=>{
  const req=request(url,{method:'GET',agent:false,headers,signal,lookup:(_host,options,callback)=>options?.all?callback(null,[{address,family:4}]):callback(null,address,4)},resolve);
  req.setTimeout(15000,()=>req.destroy(mediaError('timeout','Media source timed out')));req.on('error',reject);req.end();
 });
 if([301,302,303,307,308].includes(response.statusCode)){
  const location=response.headers.location;response.destroy();
  if(!location||depth>=3)throw mediaError('redirect','Media source redirected too many times');
  return openPublicMedia(publicMediaUrl(location,href),{headers,signal,lookup,request},depth+1);
 }
 if([401,403,429].includes(response.statusCode)){response.destroy();throw mediaError('blocked','This source did not allow access to the video');}
 if(![200,206].includes(response.statusCode)){response.destroy();throw mediaError('unavailable','This video source is unavailable');}
 return {response,url:href};
}
export async function limitedText(response,limit=MAX_TEXT){
 const chunks=[];let size=0;
 try{for await(const chunk of response){size+=chunk.length;if(size>limit)throw mediaError('too_large','Media document is too large');chunks.push(chunk);}return Buffer.concat(chunks).toString('utf8');}
 finally{response.destroy();}
}
async function checkMp4(response){
 const chunks=[];let size=0;
 try{for await(const chunk of response){chunks.push(chunk);size+=chunk.length;if(size>=32)break;}const prefix=Buffer.concat(chunks).subarray(0,64);if(!prefix.includes(Buffer.from('ftyp')))throw mediaError('invalid_media','The source did not return an MP4 video');}
 finally{response.destroy();}
}
function attribute(tag,name){const match=tag.match(new RegExp('(?:^|\\s)'+name+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')','i'));return match?.[1]??match?.[2];}
function entities(value){return value.replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#(?:x([0-9a-f]+)|(\d+));/gi,(_,hex,dec)=>String.fromCodePoint(parseInt(hex||dec,hex?16:10)));}
export function declaredMedia(html,pageUrl){
 const results=[];
 function add(value,type=''){
  if(typeof value!=='string')return;
  try{const url=publicMediaUrl(entities(value),pageUrl),path=new URL(url).pathname.toLowerCase();const format=/\.m3u8$/.test(path)||/mpegurl/i.test(type)?'hls':/\.(?:mp4|m4v)$/.test(path)||/^video\/mp4$/i.test(type)?'mp4':null;if(format&&!results.some(x=>x.url===url))results.push({url,format});}catch{}
 }
 // Only declared video resources are used. Scripts are never executed,
 // unpacked or decoded; an unrelated sample URL in a script is not the film.
 const withoutScripts=html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'');
 for(const match of withoutScripts.matchAll(/<(?:video|source|meta|a)\b[^>]*>/gi)){
  const tag=match[0];if(/^<(?:video|source)\b/i.test(tag))add(attribute(tag,'src'),attribute(tag,'type')||'');
  else if(/^<meta\b/i.test(tag)&&/^og:video(?::url|:secure_url)?$/i.test(attribute(tag,'property')||''))add(attribute(tag,'content'));
  else if(/^<a\b/i.test(tag)&&/\sdownload(?:\s|=|>)/i.test(tag))add(attribute(tag,'href'));
 }
 for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)){
  try{const data=JSON.parse(match[1]);const items=Array.isArray(data)?data:[data,...(data['@graph']||[])];for(const item of items)if(item&&[item['@type']].flat().includes('VideoObject'))add(item.contentUrl,item.encodingFormat||'');}catch{}
 }
 // Plain JW Player source declarations are data, not executable extractors.
 // Ignore unrelated variables and packed/encrypted player scripts entirely.
 const plainScripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map(match=>match[1]).filter(script=>!/\b(?:eval|atob|Function)\s*\(/.test(script));
 for(const script of plainScripts)for(const match of script.matchAll(/\bjwplayer\s*\([^)]{1,200}\)\s*\.setup\s*\(\s*\{([\s\S]{0,50000}?)\}\s*\)/gi)){
  for(const sources of match[1].matchAll(/(?:["']?sources["']?)\s*:\s*\[([^\]]{1,20000})\]/gi)){
   for(const item of sources[1].matchAll(/\{([^{}]{1,6000})\}/g)){
    const file=item[1].match(/(?:["']?file["']?)\s*:\s*(["'])([^"'\\]*(?:\\.[^"'\\]*)*)\1\s*(?=[,}]|$)/i);
    if(!file)continue;
    let value=file[2];try{if(file[1]==='"')value=JSON.parse('"'+value+'"');else value=value.replace(/\\\//g,'/');}catch{continue;}
    const type=item[1].match(/(?:["']?type["']?)\s*:\s*["']([^"']+)["']/i)?.[1]||'';
    add(value,/^hls$/i.test(type)?'application/vnd.apple.mpegurl':type);
   }
  }
 }
 return results;
}
export function rewriteHls(manifest,base,tokenFor){
 if(!manifest.trimStart().startsWith('#EXTM3U'))throw mediaError('invalid_manifest','Invalid HLS playlist');
 if(/#EXT-X-(?:KEY|SESSION-KEY):[^\r\n]*METHOD=(?!NONE(?:,|\s|$))/i.test(manifest))throw mediaError('protected_source','This stream requires a supported player from its provider');
 return manifest.split(/\r?\n/).map(line=>{
  if(!line.trim())return line;
  if(!line.startsWith('#'))return tokenFor(publicMediaUrl(line.trim(),base));
  return line.replace(/\bURI="([^"]+)"/g,(_,uri)=>'URI="'+tokenFor(publicMediaUrl(uri,base))+'"');
 }).join('\n');
}
export function createMediaResolver({localApi,open=openPublicMedia,clock=Date.now}={}){
 const cache=new Map(),tokens=new Map();let active=0;
 function purge(){for(const[k,v]of cache)if(v.until<=clock())cache.delete(k);for(const[k,v]of tokens)if(v.until<=clock())tokens.delete(k);}
 function tokenFor(url,format='auto',until=clock()+4*3600000){
  purge();for(const[k,v]of tokens)if(v.url===url&&v.until>=until)return '/activity/api/kc/stream/'+k;
  if(tokens.size>=12000)throw mediaError('capacity','Cinema is busy; try again later',503);
  const key=crypto.randomBytes(24).toString('hex');tokens.set(key,{url,format,until});return '/activity/api/kc/stream/'+key;
 }
 async function inspectProvider(value,signal){
  const page=publicMediaUrl(value);if(!providerHosts.has(new URL(page).hostname))throw mediaError('unsupported_provider','This movie provider is not supported');
  const {response,url}=await open(page,{signal});const type=String(response.headers['content-type']||'');
  if(/video\/mp4/i.test(type)){await checkMp4(response);return {url,format:'mp4'};}
  if(/(?:mpegurl)/i.test(type)){const text=await limitedText(response);rewriteHls(text,url,x=>x);return {url,format:'hls'};}
  if(!/text\/html/i.test(type)){response.destroy();throw mediaError('no_direct_source','The provider did not expose a direct video source');}
  const html=await limitedText(response),sources=declaredMedia(html,url);
  if(!sources.length)throw mediaError('no_direct_source','The provider did not expose a direct MP4 or HLS source');
  for(const source of sources.slice(0,3)){
   try{
    const checked=await open(source.url,{headers:source.format==='mp4'?{Range:'bytes=0-1023'}:{},signal});
    const mime=String(checked.response.headers['content-type']||'');
    if(source.format==='mp4'){if(!/^video\/mp4(?:;|$)/i.test(mime)){checked.response.destroy();continue;}await checkMp4(checked.response);}
    else{const manifest=await limitedText(checked.response);rewriteHls(manifest,checked.url,x=>x);}
    return {...source,url:checked.url};
   }catch(error){if(error.code==='blocked'||error.code==='protected_source')throw error;}
  }
  throw mediaError('unavailable','The declared video source could not be opened');
 }
 async function resolve(movieUrl,serverId){
  const canonical=normalizeCinemaLink(movieUrl);if(!/^https:\/\/kurdcinama\.com\/online\.aspx\?movieid=\d{1,10}$/.test(canonical))throw mediaError('invalid_movie','Enter a Kurd Cinema movie link',400);
  if(serverId!==undefined&&!/^\d{1,12}$/.test(serverId))throw mediaError('invalid_server','Invalid movie server',400);
  purge();const key=canonical+'|'+(serverId||'');if(cache.has(key))return cache.get(key).promise;
  if(cache.size>=100)cache.delete(cache.keys().next().value);
  const promise=(async()=>{
   const movie=await localApi('resolve',{url:canonical});const servers=(movie.servers||[]).filter(s=>/^\d{1,12}$/.test(String(s.id))&&(!serverId||String(s.id)===serverId)).slice(0,5);
   if(!servers.length)throw mediaError('no_servers','No matching servers were found for this movie');
   const failures=[],signal=AbortSignal.timeout(30000);
   for(const server of servers){
    try{signal.throwIfAborted();const player=await localApi('server',{url:canonical,serverId:String(server.id)});const source=await inspectProvider(player.embedUrl,signal);return {title:movie.title,movieUrl:canonical,serverId:String(server.id),format:source.format,streamPath:tokenFor(source.url,source.format)};}
    catch(error){failures.push({label:String(server.label||server.id).slice(0,100),code:error.code||'unavailable'});if(signal.aborted)break;}
   }
   throw Object.assign(mediaError('no_playable_source','No accessible MP4/HLS video source was found for this movie'),{sources:failures});
  })();cache.set(key,{until:clock()+5*60000,promise});return promise;
 }
 async function stream(key,req,res){
  purge();const entry=tokens.get(key);if(!entry)throw mediaError('expired','Video link expired. Reload the movie.',410);
  if(active>=32)throw mediaError('capacity','Cinema is busy; try again later',503);
  const range=req.headers.range;if(range&&!/^bytes=\d*-\d*$/.test(range))throw mediaError('invalid_range','Unsupported byte range',416);
  active++;const controller=new AbortController();const cancel=()=>controller.abort();res.on('close',cancel);
  try{
   const {response,url}=await open(entry.url,{headers:range&&entry.format!=='hls'?{Range:range}:{},signal:controller.signal});
   const mime=String(response.headers['content-type']||'');const isManifest=entry.format==='hls'||/mpegurl/i.test(mime)||/\.m3u8$/i.test(new URL(url).pathname);
   res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
   if(isManifest){const body=rewriteHls(await limitedText(response),url,value=>tokenFor(value,'auto',entry.until).split('/').at(-1));res.type('application/vnd.apple.mpegurl').send(body);}
   else{
    if(/html|json|javascript|xml/i.test(mime)){response.destroy();throw mediaError('invalid_media','The provider returned a page instead of video');}
    res.status(response.statusCode);res.set('Content-Type',entry.format==='mp4'?'video/mp4':mime||'application/octet-stream');for(const name of ['content-length','content-range','accept-ranges'])if(response.headers[name])res.set(name,response.headers[name]);
    await pipeline(response,res);
   }
  }finally{active--;res.off('close',cancel);}
 }
 return {resolve,stream,demo:()=>({title:'HLS playback sample',format:'hls',streamPath:tokenFor('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8','hls')})};
}
export function cinemaMediaMiddleware({port=Number(process.env.PORT||3000),resolver}={}){
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid Cinema port');
 resolver||=createMediaResolver({localApi:async(action,query)=>{
  const response=await fetch('http://127.0.0.1:'+port+'/activity/api/kc/'+action+'?'+new URLSearchParams(query),{signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!response.ok)throw mediaError('unavailable','Movie server lookup failed');return response.json();
 }});
 const rates=new Map();
 return async(req,res,next)=>{
  const path=req.url.split('?')[0];if(!['/activity/api/kc/media','/activity/api/kc/demo'].includes(path)&&!/^\/activity\/api\/kc\/stream\/[a-f0-9]{48}$/.test(path))return next();
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  try{
   if(path==='/activity/api/kc/media'||path==='/activity/api/kc/demo'){
    const now=Date.now();for(const[k,v]of rates)if(v.until<now)rates.delete(k);const ip=req.ip||'unknown',rate=rates.get(ip)||{until:now+60000,count:0};if(++rate.count>20||rates.size>=10000)throw mediaError('rate_limit','Please wait before checking more movies',429);rates.set(ip,rate);
    if(path==='/activity/api/kc/demo'){res.set('Cache-Control','no-store');return res.json(resolver.demo());}
    const query=new URL(req.url,'https://vex.invalid').searchParams;if(query.getAll('url').length!==1||query.getAll('serverId').length>1)throw mediaError('invalid_movie','Invalid movie request',400);
    res.set('Cache-Control','no-store');res.json(await resolver.resolve(query.get('url'),query.get('serverId')??undefined));
   }else await resolver.stream(path.split('/').at(-1),req,res);
  }catch(error){if(res.headersSent){res.destroy();return;}res.status(error.status||502).json({error:error.code?error.message:'Movie source could not be opened',code:error.code||'unavailable',...(error.sources?{sources:error.sources}:{})});}
 };
}
