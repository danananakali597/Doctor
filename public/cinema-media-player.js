let hlsModule;
export function activityStreamUrl(value,apiRoot){
 if(!/^\/activity\/api\/kc\/stream\/[a-f0-9]{48}$/.test(value))throw Error('Invalid VEX video stream');
 if(!['/activity/api','/.proxy/api'].includes(apiRoot))throw Error('Invalid Activity API');
 return apiRoot+value.slice('/activity/api'.length);
}
export async function attachCinemaMedia(video,source,{onError=()=>{},loadHls=()=>hlsModule||=(import('./hls.mjs'))}={}){
 video.playsInline=true;video.preload='metadata';
 let hls=null,cancelled=false;
 const cleanup=()=>{cancelled=true;hls?.destroy();video.pause();video.removeAttribute('src');video.load();};
 if(source.format==='mp4'){video.src=source.url;return cleanup;}
 if(source.format!=='hls')throw Error('Unsupported video format');
 const {default:Hls}=await loadHls();if(cancelled)return cleanup;
 if(!Hls.isSupported()){
  if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=source.url;return cleanup;}
  throw Error('HLS is not supported on this device');
 }
 hls=new Hls({enableWorker:false,maxBufferLength:30,maxMaxBufferLength:60});
 hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal)onError('This video stream could not be played.');});
 hls.loadSource(source.url);hls.attachMedia(video);return cleanup;
}
