export function nextMonthlyPeriodEnd(start=Date.now()){
 if(!Number.isSafeInteger(start)||start<0)throw Error('Invalid billing period start');
 const d=new Date(start),day=d.getUTCDate();
 if(!Number.isFinite(d.getTime()))throw Error('Invalid billing period start');
 d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);
 const lastDay=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
 d.setUTCDate(Math.min(day,lastDay));
 const end=d.getTime();if(!Number.isSafeInteger(end))throw Error('Invalid billing period end');
 return end;
}
