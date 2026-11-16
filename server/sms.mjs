export function normalizePhone(value) {
 const number=String(value??'').trim().replace(/[\s()-]/g,'').replace(/^010(?=\d{8}$)/,'+8210');
 if(!/^\+[1-9]\d{7,14}$/.test(number))throw Error('전화번호를 010 또는 +국가번호 형식으로 입력하세요.');
 return number;
}

export function smsReady(env=process.env) {
 return /^AC[a-f\d]{32}$/i.test(env.TWILIO_ACCOUNT_SID??'') && Boolean(env.TWILIO_AUTH_TOKEN &&
  env.TWILIO_FROM_NUMBER && env.TWILIO_VERIFIED_TO);
}

export async function sendSms(to,text,env=process.env) {
 if(!smsReady(env)||normalizePhone(env.TWILIO_VERIFIED_TO)!==normalizePhone(to))throw Error('SMS recipient not verified');
 const body=new URLSearchParams({To:to,From:normalizePhone(env.TWILIO_FROM_NUMBER),Body:text});
 const auth=Buffer.from(env.TWILIO_ACCOUNT_SID+':'+env.TWILIO_AUTH_TOKEN).toString('base64');
 const result=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,{
  method:'POST',body,headers:{Authorization:'Basic '+auth},redirect:'error',signal:AbortSignal.timeout(12000),
 });
 if(!result.ok)throw Error('SMS provider did not accept message');
}
