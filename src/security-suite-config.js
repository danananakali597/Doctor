// Versioned configuration: existing rules retain their current behavior on upgrade.
export const harmCategories=['harassment','harassment/threatening','hate','hate/threatening','sexual','violence/graphic'];
export const securitySuiteDefaults=()=>({mode:'enforce',language:'ckb',ai:{enabled:false,images:false,paidReview:false,context:false,action:'log',timeoutMinutes:10,threshold:0.9,reviewThreshold:0.45,monthlyBudgetCents:500,maxPaidReviewsPerDay:100,maxChecksPerMinute:30,policy:'',categories:[...harmCategories]}});
export function mergeSecuritySuite(base,patch={}){return {...base,...patch,ai:{...base.ai,...patch.ai}};}
export function validateSecuritySuite(p,owner){
 if(!owner)throw Error('Server owner required for AI Security configuration');
 if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Invalid AI Security configuration');
 const out={};for(const [key,value]of Object.entries(p)){
  if(key==='mode'){if(!['monitor','enforce','paused'].includes(value))throw Error('Invalid security mode');out[key]=value;}
  else if(key==='language'){if(!['ckb','ar','en'].includes(value))throw Error('Invalid security language');out[key]=value;}
  else if(key==='ai'){
   if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid AI configuration');const a={};
   const numbers={timeoutMinutes:[1,1440,true],threshold:[0.7,1,false],reviewThreshold:[0.1,0.69,false],monthlyBudgetCents:[0,10000,true],maxPaidReviewsPerDay:[0,1000,true],maxChecksPerMinute:[1,120,true]};
   for(const [k,v]of Object.entries(value)){
    if(['enabled','images','paidReview','context'].includes(k)){if(typeof v!=='boolean')throw Error('Invalid AI toggle');}
    else if(k==='action'){if(!['log','delete','timeout'].includes(v))throw Error('Invalid AI response');}
    else if(numbers[k]){const [min,max,integer]=numbers[k];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||integer&&!Number.isInteger(v))throw Error('Invalid AI limit: '+k);}
    else if(k==='policy'){if(typeof v!=='string'||v.length>1000)throw Error('Custom policy must be at most 1000 characters');}
    else if(k==='categories'){if(!Array.isArray(v)||!v.length||v.some(c=>!harmCategories.includes(c)))throw Error('Invalid moderation categories');}
    else throw Error('Unknown AI setting: '+k);
    a[k]=k==='categories'?[...new Set(v)]:v;
   }out.ai=a;
  }else throw Error('Unknown security setting: '+key);
 }return out;
}
