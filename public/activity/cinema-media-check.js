import {attachCinemaMedia,activityStreamUrl} from './cinema-media-player.js?v=1';
const result=document.getElementById('result'),video=document.getElementById('video');
const buttons=[...document.querySelectorAll('button')],apiRoot=location.hostname.endsWith('discordsays.com')?'/.proxy/api':'/activity/api';
let dispose=null,generation=0;
async function run(getSource){
 const current=++generation;dispose?.();dispose=null;buttons.forEach(b=>b.disabled=true);result.textContent='Loading video…';
 try{const source=await getSource();const cleanup=await attachCinemaMedia(video,source,{onError:message=>result.textContent=message});if(current!==generation){cleanup();return;}dispose=cleanup;result.textContent=(source.title||source.format)+' — press Play and verify the video.';}
 catch(error){result.textContent=error.message;}finally{if(current===generation)buttons.forEach(b=>b.disabled=false);}
}
async function api(path){const response=await fetch(apiRoot+path);const data=await response.json();if(!response.ok)throw Error(data.error+(data.sources?' — '+data.sources.map(s=>s.label+': '+s.code).join('; '):''));return {...data,url:activityStreamUrl(data.streamPath,apiRoot)};}
document.getElementById('resolve').addEventListener('click',()=>run(()=>{
 const id=document.getElementById('movieid').value;if(!/^\d{1,10}$/.test(id))throw Error('Enter a numeric movie ID');return api('/kc/media?'+new URLSearchParams({url:'https://kurdcinama.com/online.aspx?movieid='+id}));
}));
document.getElementById('mp4').addEventListener('click',()=>run(()=>({title:'MP4 playback sample',format:'mp4',url:'./test-v12.mp4'})));
document.getElementById('hls').addEventListener('click',()=>run(()=>api('/kc/demo')));
video.addEventListener('playing',()=>result.textContent='Video is playing.');
video.addEventListener('error',()=>result.textContent='Video playback failed.');
