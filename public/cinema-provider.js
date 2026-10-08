export const cinemaDiscordHost='1552793371183939624.discordsays.com';
export function cinemaProviderUrl(value,hostname){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error('Unsupported player URL');
 if(hostname!==cinemaDiscordHost)return url.href;
 if(!['vidmoly.org','www.vidmoly.org'].includes(url.hostname))throw Error('This provider has no Discord URL mapping. Choose the vidmoly server.');
 if(!/^\/embed-[a-z0-9]+\.html$/i.test(url.pathname))throw Error('Unsupported Vidmoly player path');
 return '/.proxy/kc/vidmoly'+url.pathname+url.search;
}
export function configureCinemaFrame(frame,value,hostname){
 // Mapped provider HTML shares the proxy's host. Keep it isolated from VEX.
 frame.setAttribute('sandbox','allow-scripts allow-forms allow-presentation');
 frame.src=cinemaProviderUrl(value,hostname);
 frame.allow='autoplay; fullscreen; picture-in-picture';
 frame.setAttribute('allowfullscreen','');
}
