export class WindowCounter{
 constructor(max=20000){this.items=new Map();this.max=max;}
 hit(key,seconds,now=Date.now(),value=''){const cutoff=now-seconds*1000;const a=(this.items.get(key)||[]).filter(x=>x.t>cutoff);a.push({t:now,v:value});this.items.delete(key);this.items.set(key,a);if(this.items.size>this.max)this.items.delete(this.items.keys().next().value);return a;}
}
export const domains=value=>String(value||'').toLowerCase().split(/[\s,]+/).filter(Boolean).map(x=>x.replace(/^https?:\/\//,'').replace(/\/$/,''));
export const domainMatches=(host,domain)=>host===domain||host.endsWith('.'+domain);
export function urls(text){return (text.match(/(?:https?:\/\/|www\.)[^\s<>]+|\b(?:discord\.gg|discord(?:app)?\.com\/invite)\/[^\s<>]+/gi)||[]).slice(0,30).flatMap(raw=>{try{return[new URL(raw.startsWith('http')?raw:'https://'+raw)];}catch{return[];}});}
export function messageReasons(input,enabled,counter,now=Date.now()){
 const {guildId,userId,content,mentions=0,everyone=false}=input,key=guildId+':'+userId,result=[],links=urls(content),m=id=>enabled(id);
 if(m('spam')){const s=m('spam'),a=counter.hit(key+':spam',s.window,now,content.toLowerCase().trim());if(a.length>=s.limit||a.filter(x=>x.v===content.toLowerCase().trim()).length>=s.duplicates)result.push('spam');}
 if(m('links')&&links.some(u=>!domains(m('links').allowedDomains).some(d=>domainMatches(u.hostname,d))))result.push('links');
 if(m('invites')&&/\b(?:discord\.gg|discord(?:app)?\.com\/invite)\s*\//i.test(content))result.push('invites');
 if(m('mentions')&&(everyone||mentions>=m('mentions').limit))result.push('mentions');
 if(m('words')){const words=content.normalize('NFKC').toLowerCase().split(/[^\p{L}\p{N}_]+/u);if(String(m('words').words).split(/\n|,/).map(x=>x.trim().normalize('NFKC').toLowerCase()).filter(Boolean).some(w=>w.includes(' ')?(' '+words.join(' ')+' ').includes(' '+w+' '):words.includes(w)))result.push('words');}
 if(m('automod')){const letters=content.match(/[a-z]/gi)||[];if(content.length>m('automod').length||(letters.length>=20&&letters.filter(x=>x===x.toUpperCase()).length/letters.length*100>=m('automod').caps))result.push('automod');}
 if(m('scam')&&links.some(u=>domains(m('scam').blockedDomains).some(d=>domainMatches(u.hostname,d))||(/discord|steam|nitro/i.test(u.hostname)&&!/^(?:(?:[a-z0-9-]+\.)*)(?:discord\.com|discord\.gg|discordapp\.com|steampowered\.com|steamcommunity\.com)$/.test(u.hostname)&&/gift|free|claim|nitro|login|verify/i.test(u.href))))result.push('scam');
 if(m('urls')&&links.some(u=>u.username||u.password||/^\[|^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)||u.hostname.includes('xn--')||['bit.ly','tinyurl.com','t.co'].includes(u.hostname)))result.push('urls');
 return result;
}
