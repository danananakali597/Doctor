const hosts=new Set(['kurdcinama.com','www.kurdcinama.com','kurdcinema.com','www.kurdcinema.com']);
// Normalize public movie pages only. Never fetch an arbitrary supplied domain.
export function normalizeCinemaLink(value){
 if(typeof value!=='string')return value;
 let u;try{u=new URL(value.trim());}catch{return value;}
 if(u.protocol!=='https:'||u.username||u.password||u.port||!hosts.has(u.hostname))return value;
 if(!/^\/(moves-details|online)\.aspx$/i.test(u.pathname))return value;
 const ids=u.searchParams.getAll('movieid');if(ids.length!==1||!/^\d{1,10}$/.test(ids[0]))return value;
 return 'https://kurdcinama.com/online.aspx?movieid='+ids[0];
}
export function cinemaLinkMiddleware(req,_res,next){
 // Existing Cinema routes still perform their authentication and validation.
 if(/^\/activity\/api\/kc\/(resolve|server)(?:\?|$)/.test(req.url)){
  const u=new URL(req.url,'https://vex.invalid');
  if(u.searchParams.getAll('url').length===1){const old=u.searchParams.get('url'),normalized=normalizeCinemaLink(old);if(normalized!==old){u.searchParams.set('url',normalized);req.url=u.pathname+u.search;if(req.query&&Object.hasOwn(req.query,'url'))req.query.url=normalized;}}
 }
 if(/^\/activity\/api\/session\/(claim|control)(?:\?|$)/.test(req.url)&&req.body&&typeof req.body==='object'&&!Array.isArray(req.body))req.body.mediaUrl=normalizeCinemaLink(req.body.mediaUrl);
 next();
}
