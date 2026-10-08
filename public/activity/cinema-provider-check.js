import {configureCinemaFrame,cinemaDiscordHost} from './cinema-provider.js';
const status=document.getElementById('result');
const check=document.getElementById('check'),input=document.getElementById('movieid');
if(location.hostname!==cinemaDiscordHost){status.textContent='Open this test through the Discord Activity origin.';check.disabled=true;}
else check.addEventListener('click',async()=>{
 if(!/^\d{1,10}$/.test(input.value)){status.textContent='Enter a numeric movie ID.';return;}
 check.disabled=true;status.textContent='Resolving the movie…';
 const movie='https://kurdcinama.com/online.aspx?movieid='+input.value;
 async function api(path){const r=await fetch('/.proxy/api/kc/'+path);const d=await r.json();if(!r.ok)throw Error(d.error||'Movie request failed');return d;}
 try{const resolved=await api('resolve?'+new URLSearchParams({url:movie}));const server=(resolved.servers||[]).find(s=>/vidmoly/i.test(s.label||''));if(!server)throw Error('This movie has no vidmoly server');const player=await api('server?'+new URLSearchParams({url:movie,serverId:server.id}));configureCinemaFrame(document.getElementById('player'),player.embedUrl,location.hostname);status.textContent=resolved.title+' — player requested. Test playback inside the frame.';}catch(e){status.textContent=e.message;}finally{check.disabled=false;}
});
