// Short-lived memory only: message bodies are never written to the database.
export function createMessageLogContext({now=Date.now,waitMs=1500}={}) {
 const messages=new Map(),pending=new Map(),audits=new Map();
 const key=m=>`${m.guild?.id}:${m.id}`;
 const group=m=>`${m.guild?.id}:${m.channelId}:${m.author?.id}`;
 const trim=()=>{for(const [k,v] of messages)if(now()-v.at>600000)messages.delete(k);while(messages.size>1000)messages.delete(messages.keys().next().value);for(const [k,v]of audits)if(now()-v.at>5000)audits.delete(k);};
 function remember(m){if(!m.guild||!m.author||m.author.bot)return;trim();messages.set(key(m),{at:now(),author:m.author,content:typeof m.content==='string'?m.content.slice(0,4000):m.content,attachments:[...(m.attachments?.values?.()||[])].map(a=>a.url).slice(0,5)});trim();}
 function audit(entry,guild){trim();if(!entry.executorId||!entry.targetId||!entry.extra?.channel?.id||Number(entry.extra.count)!==1||Math.abs(now()-entry.createdTimestamp)>5000)return;while(audits.size>=1000)audits.delete(audits.keys().next().value);audits.set(entry.id,{at:now(),group:`${guild.id}:${entry.extra.channel.id}:${entry.targetId}`,actor:entry.executorId,reason:entry.reason});}
 async function deleted(m){trim();const cached=messages.get(key(m));messages.delete(key(m));const author=m.author||cached?.author;
 const snapshot={...m,author,guild:m.guild,channelId:m.channelId};const g=group(snapshot);
 const record={ambiguous:false,at:now()};const siblings=pending.get(g)||new Set();if(siblings.size){record.ambiguous=true;for(const p of siblings)p.ambiguous=true;}siblings.add(record);pending.set(g,siblings);
 await new Promise(resolve=>setTimeout(resolve,waitMs));
 const matches=[...audits].filter(([,a])=>a.group===g&&Math.abs(a.at-record.at)<=waitMs);let actor,reason;
 if(!record.ambiguous&&matches.length===1){const [id,a]=matches[0];actor=a.actor;reason=a.reason;audits.delete(id);}
 siblings.delete(record);if(!siblings.size)pending.delete(g);
 const content=m.content??cached?.content;
 const attachments=m.attachments?.size?[...m.attachments.values()].map(a=>a.url).slice(0,5):cached?.attachments;
 return {author:author?.id||'Unavailable — message was not cached',channel:m.channelId,content:content===undefined||content===null?'Unavailable — message was not cached or Message Content access is disabled':content||'(No text, or Message Content access is disabled)',attachments:attachments?.length?attachments.join('\n'):undefined,deleted_by:actor||'Unconfirmed — Discord did not provide a unique matching audit entry',reason,message:m.id,avatar_url:author?.displayAvatarURL?.({size:128})};
 }
 return {remember,audit,deleted};
}
