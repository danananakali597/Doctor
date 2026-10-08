const listeners=new Set();
export const onDomainEvent=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
export function emitDomainEvent(guild,kind,detail,id){for(const fn of listeners)queueMicrotask(()=>Promise.resolve().then(()=>fn({guild,kind,detail,id,at:Date.now()})).catch(e=>console.warn('VEX_DOMAIN_EVENT_FAILED',e.code||e.name)));}
