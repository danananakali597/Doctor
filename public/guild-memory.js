const key=user=>'vex:last-guild:'+user;
export function rememberGuild(user,guild){try{localStorage.setItem(key(user),guild);}catch{}}
export function preferredGuild(user,guilds,requested){let saved;try{saved=localStorage.getItem(key(user));}catch{}return guilds.find(g=>g.installed&&g.id===requested)||guilds.find(g=>g.installed&&g.id===saved)||guilds.find(g=>g.installed);}
