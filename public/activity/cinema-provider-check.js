import {configureCinemaFrame,cinemaDiscordHost} from './cinema-provider.js';
const status=document.getElementById('result');
if(location.hostname!==cinemaDiscordHost)status.textContent='Open this test through the Discord Activity origin.';
else{try{configureCinemaFrame(document.getElementById('player'),'https://vidmoly.org/embed-r41cdi4aclzm.html',location.hostname);status.textContent='Player requested. Inspect the frame and test playback.';}catch(e){status.textContent=e.message;}}
