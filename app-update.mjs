
const sundayKey='stocking-update-sunday';
const koreaClock=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'});
function sundayDate(now=new Date()){
 const p=Object.fromEntries(koreaClock.formatToParts(now).map(x=>[x.type,x.value]));
 return p.weekday==='Sun'?p.year+'-'+p.month+'-'+p.day:null;
}
const versionKey='stocking-deployment-version';
let checking=false,refreshPending=false,lastCheck=0,nextVersion;
const baselineFields=new Map();
function modifiedInputs(){
 return [...document.querySelectorAll('input,textarea')].some(field=>{
  if(['button','submit','checkbox','radio','hidden'].includes(field.type))return false;
  if(field.type==='file')return field.files?.length>0;
  return field.value!== (baselineFields.get(field)??field.defaultValue??'');
 });
}
function apply(){
 if(!refreshPending||document.visibilityState==='hidden'||modifiedInputs()||document.querySelector('dialog[open]'))return;
 localStorage.setItem(versionKey,nextVersion);
 location.reload();
}
async function check(){
 if(checking||document.visibilityState==='hidden'||Date.now()-lastCheck<30000)return;
 const date=sundayDate();
 if(!date||localStorage.getItem(sundayKey)===date)return;
 checking=true;lastCheck=Date.now();
 try{
  const response=await fetch('/api/app-version',{cache:'no-store'});
  if(!response.ok)return;
  const {version}=await response.json();
  if(!version)return;
  localStorage.setItem(sundayKey,date);
  const previous=localStorage.getItem(versionKey);
  if(previous&&previous!==version){nextVersion=version;refreshPending=true;apply()}
  else localStorage.setItem(versionKey,version);
 }catch{}finally{checking=false}
}
document.querySelectorAll('input,textarea').forEach(field=>baselineFields.set(field,field.value));
document.addEventListener('submit',()=>setTimeout(apply,1000));
document.addEventListener('reset',()=>setTimeout(apply,100));
document.addEventListener('focusout',()=>setTimeout(apply,500));
window.addEventListener('focus',check);
document.addEventListener('visibilitychange',()=>{check();apply()});
setInterval(()=>{check();apply()},3600000);
check();
