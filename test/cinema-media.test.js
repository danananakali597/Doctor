import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import express from 'express';
import {declaredMedia,publicMediaUrl,publicIPv4,openPublicMedia,rewriteHls,createMediaResolver,cinemaMediaMiddleware,mediaError} from '../src/cinema-media.js';
import {integrateCinemaMediaWeb,integrateCinemaDirectPlayer} from '../src/cinema-link-runtime.js';
import {activityStreamUrl,attachCinemaMedia} from '../public/cinema-media-player.js';
const movie='https://kurdcinama.com/online.aspx?movieid=19765';
function response(body,type='text/html',statusCode=200){const r=Readable.from([Buffer.isBuffer(body)?body:Buffer.from(body)]);r.headers={'content-type':type};r.statusCode=statusCode;return r;}
function localApi(servers=[{id:'1',label:'vidmoly'}]){return async(action,{serverId})=>action==='resolve'?{title:'Fixture film',servers}:{embedUrl:serverId==='2'?'https://voe.sx/e/example':'https://vidmoly.org/embed-fixture.html'};}
const mp4=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.alloc(32)]);
test('only explicitly declared video resources are extracted, never a sample hidden in script',()=>{
 const html='<script>var source="https://cdn.example.com/sample.mp4";</script><video><source src="/real.m3u8?a=1&amp;b=2" type="application/vnd.apple.mpegurl"></video><meta property="og:video" content="https://cdn.example.com/movie.mp4"><a href="/ad.mp4">Ad</a>';
 assert.deepEqual(declaredMedia(html,'https://vidmoly.org/embed-example.html'),[{url:'https://vidmoly.org/real.m3u8?a=1&b=2',format:'hls'},{url:'https://cdn.example.com/movie.mp4',format:'mp4'}]);
 assert.deepEqual(declaredMedia('<script type="application/ld+json">{"@type":"VideoObject","contentUrl":"https://cdn.example.com/movie.mp4"}</script>','https://vidmoly.org/'),[{url:'https://cdn.example.com/movie.mp4',format:'mp4'}]);
});
test('unsafe addresses and private networks cannot become media requests',()=>{
 for(const url of ['http://cdn.example.com/v.mp4','https://user:secret@cdn.example.com/v.mp4','https://cdn.example.com:8443/v.mp4','https://127.0.0.1/v.mp4','https://[::1]/v.mp4','https://metadata.internal/v.mp4','https://localhost/v.mp4'])assert.throws(()=>publicMediaUrl(url));
 for(const address of ['10.0.0.1','127.0.0.1','169.254.169.254','172.16.0.1','192.168.1.1','100.64.0.1','198.18.0.1','203.0.113.1','224.0.0.1','::1'])assert.equal(publicIPv4(address),false,address);
 assert.equal(publicIPv4('8.8.8.8'),true);
});
test('DNS checks bind the connection to the inspected public address',async()=>{
 let connections=0;
 const request=(_url,options,callback)=>{connections++;options.lookup('changed.example.com',{},(err,address,family)=>{assert.equal(err,null);assert.equal(address,'8.8.8.8');assert.equal(family,4);});assert.equal(options.agent,false);assert.deepEqual(options.headers,{});const req=new EventEmitter();req.setTimeout=()=>{};req.end=()=>callback(response('page'));return req;};
 const opened=await openPublicMedia('https://provider.example.com/movie',{lookup:async()=>[{address:'8.8.8.8',family:4}],request});opened.response.destroy();assert.equal(connections,1);
 await assert.rejects(openPublicMedia('https://provider.example.com/movie',{lookup:async()=>[{address:'127.0.0.1',family:4}],request}),{code:'unsafe_address'});assert.equal(connections,1);
});
test('a redirect to a local address is rejected without a second request',async()=>{
 let connections=0;const request=(_url,_options,callback)=>{connections++;const req=new EventEmitter();req.setTimeout=()=>{};req.end=()=>{const r=response('', 'text/html',302);r.headers.location='https://127.0.0.1/private';callback(r);};return req;};
 await assert.rejects(openPublicMedia('https://provider.example.com/movie',{lookup:async()=>[{address:'8.8.8.8'}],request}),{code:'unsafe_url'});assert.equal(connections,1);
});
test('HLS manifests rewrite playlists, segments and initialization maps',()=>{
 const manifest='#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:5,\nsegment.ts\n#EXT-X-STREAM-INF:BANDWIDTH=1\nvariant.m3u8\n';let i=0,urls=[];
 const result=rewriteHls(manifest,'https://cdn.example.com/path/master.m3u8',url=>{urls.push(url);return 'token'+ ++i;});
 assert.match(result,/URI="token1"/);assert.match(result,/\ntoken2\n/);assert.equal(urls[2],'https://cdn.example.com/path/variant.m3u8');
 assert.throws(()=>rewriteHls('#EXTM3U\nhttp://localhost/secret','https://cdn.example.com/',x=>x));
 assert.throws(()=>rewriteHls('#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI="key"','https://cdn.example.com/',x=>x),{code:'protected_source'});
});
test('resolver skips an unavailable source and validates MP4 bytes before issuing a stream',async()=>{
 const calls=[];const resolver=createMediaResolver({localApi:localApi([{id:'1',label:'blocked'},{id:'2',label:'working'}]),open:async(url,options)=>{calls.push(url);if(url.startsWith('https://vidmoly.org/'))throw mediaError('blocked','blocked');if(url.startsWith('https://voe.sx/'))return {url,response:response('<video src="https://cdn.example.com/film.mp4"></video>')};assert.equal(options.headers.Range,'bytes=0-1023');return {url,response:response(mp4,'video/mp4')};}});
 const resolved=await resolver.resolve(movie);assert.equal(resolved.format,'mp4');assert.equal(resolved.serverId,'2');assert.match(resolved.streamPath,/^\/activity\/api\/kc\/stream\/[a-f0-9]{48}$/);assert.equal(calls.length,3);assert.deepEqual(await resolver.resolve(movie),resolved);assert.equal(calls.length,3);
});
test('blocked or misleading sources yield an explicit failure and are cached',async()=>{
 let calls=0;const resolver=createMediaResolver({localApi:localApi(),open:async()=>{calls++;throw mediaError('blocked','blocked');}});
 for(let n=0;n<2;n++)await assert.rejects(resolver.resolve(movie),error=>error.code==='no_playable_source'&&error.sources[0].code==='blocked');assert.equal(calls,1);
 const misleading=createMediaResolver({localApi:localApi(),open:async url=>({url,response:url.includes('embed-')?response('<video src="https://cdn.example.com/bad.mp4"></video>'):response('<html>Not a video</html>','video/mp4')})});await assert.rejects(misleading.resolve(movie),{code:'no_playable_source'});
});
test('movie and server validation never permit arbitrary internal lookups',async()=>{
 let calls=0;const resolver=createMediaResolver({localApi:async()=>calls++,open:async()=>{throw Error('unexpected');}});
 await assert.rejects(resolver.resolve('https://evil.example.com/movie'),{code:'invalid_movie'});await assert.rejects(resolver.resolve(movie,'1&url=http://localhost'),{code:'invalid_server'});assert.equal(calls,0);
});
test('HLS plays through opaque same-origin routes, with relative children valid under Discord proxy',async t=>{
 const calls=[];let now=1000;const resolver=createMediaResolver({clock:()=>now,localApi:localApi(),open:async(url,options={})=>{calls.push({url,options});if(url.includes('embed-fixture'))return {url,response:response('<video><source src="https://cdn.example.com/master.m3u8"></video>')};if(url.endsWith('.m3u8'))return {url,response:response('#EXTM3U\n#EXTINF:5,\npart.ts\n#EXT-X-ENDLIST\n','application/vnd.apple.mpegurl')};return {url,response:response('SEGMENT','video/mp2t',206)};}});
 const app=express();app.use(cinemaMediaMiddleware({resolver}));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());const base='http://127.0.0.1:'+server.address().port;
 const result=await (await fetch(base+'/activity/api/kc/media?'+new URLSearchParams({url:movie}))).json();assert.equal(result.format,'hls');
 const playlist=await (await fetch(base+result.streamPath)).text();const child=playlist.split('\n').find(line=>/^[a-f0-9]{48}$/.test(line));assert.ok(child);const source=new URL(result.streamPath,base);const segment=await fetch(new URL(child,source),{headers:{Range:'bytes=0-6'}});assert.equal(segment.status,206);assert.equal(await segment.text(),'SEGMENT');assert.equal(calls.at(-1).options.headers.Range,'bytes=0-6');
 now+=4*3600000+1;assert.equal((await fetch(base+result.streamPath)).status,410);
});
test('stream URLs preserve the configured Activity proxy and reject arbitrary targets',()=>{
 const path='/activity/api/kc/stream/'+'a'.repeat(48);assert.equal(activityStreamUrl(path,'/.proxy/api'),'/.proxy/api/kc/stream/'+'a'.repeat(48));assert.throws(()=>activityStreamUrl('https://evil.example.com/video','/.proxy/api'));assert.throws(()=>activityStreamUrl(path,'https://evil.example.com'));
});
test('HLS player uses Hls.js and cleans up resources on a source change',async()=>{
 const events=[];class Hls{static isSupported=()=>true;static Events={ERROR:'error'};on(){}loadSource(url){events.push(url);}attachMedia(){events.push('attached');}destroy(){events.push('destroyed');}}
 const video={pause:()=>events.push('paused'),load:()=>events.push('reset'),removeAttribute:()=>{},canPlayType:()=> 'maybe'};
 const dispose=await attachCinemaMedia(video,{format:'hls',url:'/same-origin'},{loadHls:async()=>({default:Hls})});assert.deepEqual(events,['/same-origin','attached']);dispose();assert.deepEqual(events.slice(-3),['destroyed','paused','reset']);
});
test('runtime adds extraction before legacy routes without removing original authentication',()=>{
 const source="export const app=express();app.post('/activity/api/session/claim',auth,handler);";const result=integrateCinemaMediaWeb(source);assert.ok(result.indexOf('app.use(cinemaMediaMiddleware())')<result.indexOf("app.post('/activity/api/session/claim'"));assert.match(result,/claim',auth,handler/);assert.equal(integrateCinemaMediaWeb(result),result);
 const player="async function kcLoadMovieServers(movieUrl){async function loadServer(id){const request=++kcServerSeq;try{const d=await kcJson('/kc/server?url='+encodeURIComponent(movieUrl));frame.src=d.embedUrl;}catch(e){notice(e.message);}}}function cancelKc(){kcRequestSeq++;}";
 const updated=integrateCinemaDirectPlayer(player);assert.match(updated,/\/kc\/media\?url=/);assert.doesNotMatch(updated,/frame.src=/);assert.match(updated,/applyPlayback\(session,true\)/);assert.match(updated,/playerMode='video'/);assert.equal(integrateCinemaDirectPlayer(updated),updated);
});
