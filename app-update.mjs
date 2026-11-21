
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
 sessionStorage.setItem(versionKey,nextVersion);
 location.reload();
}
async function check(){
 if(checking||document.visibilityState==='hidden'||Date.now()-lastCheck<30000)return;
 checking=true;lastCheck=Date.now();
 try{
  const response=await fetch('/api/app-version',{cache:'no-store'});
  if(!response.ok)return;
  const {version}=await response.json();
  if(!version)return;
  const previous=sessionStorage.getItem(versionKey);
  if(previous&&previous!==version){nextVersion=version;refreshPending=true;apply()}
  else sessionStorage.setItem(versionKey,version);
 }catch{}finally{checking=false}
}
document.querySelectorAll('input,textarea').forEach(field=>baselineFields.set(field,field.value));
document.addEventListener('submit',()=>setTimeout(apply,1000));
document.addEventListener('reset',()=>setTimeout(apply,100));
document.addEventListener('focusout',()=>setTimeout(apply,500));
window.addEventListener('focus',check);
document.addEventListener('visibilitychange',()=>{check();apply()});
setInterval(()=>{check();apply()},60000);
check();
