const field=(key,label,type='text',value='',extra={})=>({key,label,type,value,...extra});
const flag=(key,label,value=false)=>field(key,label,'boolean',value);
const num=(key,label,value,min,max)=>field(key,label,'number',value,{min,max});
const channel=(key,label,types=[0,5])=>field(key,label,'channel','',{types});
const text=(key,label,value='',max=1000)=>field(key,label,'text',value,{max});
const rows=(key,label,fields,max=10)=>field(key,label,'rows',[],{fields,max});
const role=(key,label)=>field(key,label,'role','');
const mod=(id,name,group,description,fields)=>({id,name,group,description,fields:id==='general'?fields:[flag('enabled','Enabled'),...fields]});
export const communityModules=[
 mod('general','Server settings','workspace','Set the visual identity of VEX in this server.',[field('color','Accent color','color','#8270f5'),text('footer','Card footer','VEX · Your community, connected.',100)]),
 mod('embeds','Embed studio','workspace','Compose a branded Discord card, preview it and publish when ready.',[channel('channelId','Publish channel'),text('title','Card title','An announcement from your team',256),text('message','Message','Write something worth sharing.',2000)]),
 mod('welcome','Welcome','community','Greet new members with a personal card.',[channel('channelId','Welcome channel'),text('title','Card title','Welcome to {server}',256),text('message','Message','Hello {user}! You are member #{count}.',2000),field('color','Card color','color','#8270f5'),field('imageUrl','Banner image URL','url','',{max:500}),
 field('format','Message format','select','embed',{options:['embed','text']}),
 text('content','Message above the card','',1000),text('author','Author heading','WELCOME TO THE COMMUNITY',120),text('footer','Card footer','Your story starts here · {server}',200),
 flag('timestamp','Show timestamp',true),flag('mentionMember','Notify the new member',false),flag('privateCopy','Send a private copy',false),flag('includeBots','Welcome bot accounts',false),
 field('thumbnail','Portrait source','select','member',{options:['member','server','custom','none']}),field('thumbnailUrl','Custom portrait URL','url','',{max:500}),
 rows('fields','Information blocks',[text('name','Heading','',100),text('value','Text','',400),flag('inline','Side by side',true)],6),
 rows('buttons','Link buttons',[text('label','Button label','',80),field('url','Destination URL','url','',{max:500})],5)
 ]),
 mod('goodbye','Goodbye','community','Record departures with a farewell card.',[channel('channelId','Goodbye channel'),text('title','Card title','See you again',256),text('message','Message','{username} left {server}.',2000),field('color','Card color','color','#8270f5'),field('imageUrl','Banner image URL','url','',{max:500})]),
 mod('responder','Auto responder','community','Match phrases with cooldowns and controlled replies.',[num('cooldown','Cooldown seconds',30,5,3600),rows('rules','Response rules',[text('trigger','Trigger','',100),field('match','Match','select','exact',{options:['exact','contains']}),text('response','Response','',1800),channel('channelId','Only in channel')],20)]),
 mod('levels','Leveling','engagement','Reward meaningful chat with XP, ranks and role milestones.',[num('xp','XP per message',15,1,100),num('cooldown','XP cooldown seconds',60,30,3600),channel('channelId','Level-up channel'),rows('rewards','Role milestones',[num('level','Level',5,1,1000),role('roleId','Reward role')])]),
 mod('autoroles','Auto roles','community','Assign selected safe roles when human members arrive.',[field('roleIds','Join roles','roles',[])]),
 mod('selfroles','Self-assignable roles','engagement','Publish a role menu that members control themselves.',[text('title','Panel title','Make yourself at home',256),text('message','Panel message','Choose the roles that fit you.',1800),channel('channelId','Panel channel'),field('roleIds','Available roles','roles',[],{max:20}),flag('exclusive','Choose only one role')]),
 mod('starboard','Starboard','engagement','Highlight community favorites after enough star reactions.',[channel('channelId','Starboard channel'),num('threshold','Stars required',3,2,50)]),
 mod('tempvoice','Temporary voice','community','Join one lobby to create a personal voice room; empty rooms are cleaned up.',[channel('lobbyId','Voice lobby',[2]),channel('categoryId','Room category',[4]),text('name','Room name','{username}’s room',80),num('limit','User limit',5,0,99)]),
 mod('templinks','Temporary invites','community','Create limited-use invitations with /invite.',[channel('channelId','Invite destination',[0,5,2]),num('hours','Valid for hours',24,1,168),num('uses','Maximum uses',5,1,100)]),
 mod('statistics','Statistics','engagement','Daily message, join and leave totals plus an XP leaderboard. No message text is retained.',[]),
 mod('tickets','Tickets','operations','VEX Support panel with topics, request forms, assignment, transfer and live ticket progress.',[channel('categoryId','Ticket category',[4]),channel('channelId','Panel channel'),role('supportRoleId','Support role'),text('title','Panel title','Support Center',256),text('message','Panel message','Choose a topic. We will guide you from here.',1800)]),
 mod('moderation','Moderation','operations','Warn, timeout, kick, ban, unban and clear messages with numbered case records.',[]),
 mod('notifications','Creator notifications','notifications','Announce new uploads, live streams and community posts.',[rows('feeds','Sources',[field('provider','Platform','select','youtube',{options:['youtube','twitch','kick','reddit']}),text('source','Channel ID / username / subreddit','',100),channel('channelId','Announcement channel')],12)])
];
export const communityById=Object.fromEntries(communityModules.map(m=>[m.id,m]));
export const communityDefaults=()=>Object.fromEntries(communityModules.map(m=>[m.id,Object.fromEntries(m.fields.map(f=>[f.key,structuredClone(f.value)]))]));
export const mergeCommunity=(base,patch={})=>Object.fromEntries(communityModules.map(m=>[m.id,{...base[m.id],...patch[m.id]}]));
const snowflake=v=>typeof v==='string'&&/^(?:\d{17,22})?$/.test(v);
function check(f,v){
 if(f.type==='boolean'&&typeof v==='boolean')return v;
 if(f.type==='number'&&Number.isInteger(v)&&v>=f.min&&v<=f.max)return v;
 if(f.type==='text'&&typeof v==='string'&&v.length<=f.max)return v.trim();
 if(f.type==='url'&&typeof v==='string'&&v.length<=f.max){if(!v.trim())return '';try{const url=new URL(v.trim());if(url.protocol==='https:'&&url.hostname&&url.username===''&&url.password==='')return url.href;}catch{}}
 if(f.type==='color'&&typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v))return v;
 if(f.type==='select'&&f.options.includes(v))return v;
 if(['channel','role'].includes(f.type)&&snowflake(v))return v;
 if(f.type==='roles'&&Array.isArray(v)&&v.length<=(f.max||10)&&v.every(x=>snowflake(x)&&x))return [...new Set(v)];
 if(f.type==='rows'&&Array.isArray(v)&&v.length<=f.max)return v.map(row=>validateFields(f.fields,row,true));
 throw Error('Invalid value: '+f.label);
}
function validateFields(fields,p,full=false){if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Invalid module settings');const out={};for(const [k,v]of Object.entries(p)){const f=fields.find(f=>f.key===k);if(!f)throw Error('Unknown field');out[k]=check(f,v);}if(full)for(const f of fields)if(!(f.key in out))out[f.key]=structuredClone(f.value);return out;}
export function validateCommunity(p){if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Invalid community settings');const out={};for(const [id,values]of Object.entries(p)){if(!Object.hasOwn(communityById,id))throw Error('Unknown community module');out[id]=validateFields(communityById[id].fields,values);}return out;}
