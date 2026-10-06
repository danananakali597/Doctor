// Bounded short-lived snapshots for enabled message logs. Never written to SQLite.
export class MessageLogCache {
 constructor({limit=2000,ttl=30*60*1000,clock=Date.now}={}){this.entries=new Map();this.limit=limit;this.ttl=ttl;this.clock=clock;}
 key(m){return `${m.guild?.id||m.guildId}:${m.id}`;}
 get(m){const key=this.key(m),value=this.entries.get(key);if(value&&this.clock()-value.at<this.ttl)return value;this.entries.delete(key);return undefined;}
 remember(m){
  if(!m.id||!m.guild||m.author?.bot)return;
  const old=this.get(m);
  const value={at:this.clock(),author:m.author?.id||old?.author,author_name:m.author?.tag||m.author?.username||old?.author_name,avatar_url:m.author?.displayAvatarURL?.({size:128})||old?.avatar_url,content:typeof m.content==='string'?m.content.slice(0,4000):old?.content,attachments:m.attachments?.map?.(a=>a.name||'Attachment').join(', ').slice(0,500)||old?.attachments};
  const key=this.key(m);this.entries.delete(key);this.entries.set(key,value);
  // Prune expired items and impose a hard global bound, including quiet servers.
  for(const [id,item]of this.entries){if(this.clock()-item.at>=this.ttl)this.entries.delete(id);else break;}
  while(this.entries.size>this.limit)this.entries.delete(this.entries.keys().next().value);
  return value;
 }
 remove(m){this.entries.delete(this.key(m));}
}
export const unavailableMessage='Unavailable — VEX did not receive this message before it was deleted.';
export function messageText(snapshot){return snapshot?.content? snapshot.content : snapshot?.attachments?'No text — attachment message.':snapshot?.content===''?'No text available (empty message or Message Content access missing).':unavailableMessage;}
