const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==="/api/config"){
      return json({enabled:Boolean(env.TURNSTILE_SITE_KEY&&env.TURNSTILE_SECRET_KEY&&env.RESEND_API_KEY&&env.CONTACT_FROM_EMAIL&&env.CONTACT_TO_EMAIL),siteKey:env.TURNSTILE_SITE_KEY||""});
    }
    if(url.pathname==="/api/contact"){
      if(request.method!=="POST")return json({error:"Method not allowed"},405);
      if(!env.TURNSTILE_SITE_KEY||!env.TURNSTILE_SECRET_KEY||!env.RESEND_API_KEY||!env.CONTACT_FROM_EMAIL||!env.CONTACT_TO_EMAIL)return json({error:"Contact form is not configured yet"},503);
      if(Number(request.headers.get("content-length")||0)>12000)return json({error:"Message too large"},413);
      let body;try{body=await request.json()}catch{return json({error:"Invalid request"},400)}
      const name=String(body.name||"").trim(),email=String(body.email||"").trim(),phone=String(body.phone||"").trim(),message=String(body.message||"").trim(),token=String(body.token||"");
      if(name.length<2||name.length>120||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||phone.length>40||message.length<10||message.length>3000||!token)return json({error:"Please complete all required fields and verification"},400);
      const ip=request.headers.get("CF-Connecting-IP")||"";
      let verified;try{const response=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:ip})});verified=await response.json()}catch{return json({error:"Verification unavailable. Try again later."},503)}
      if(!verified.success)return json({error:"Spam verification failed. Please try again."},403);
      const clean=s=>s.replace(/[\r\n]+/g," ").replace(/[<>]/g,"");
      const emailText="New JL Sealant Solutions enquiry\n\nName: "+clean(name)+"\nEmail: "+clean(email)+"\nPhone: "+clean(phone||"Not provided")+"\n\nMessage:\n"+message;
      let result;try{result=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"authorization":"Bearer "+env.RESEND_API_KEY,"content-type":"application/json"},body:JSON.stringify({from:env.CONTACT_FROM_EMAIL,to:[env.CONTACT_TO_EMAIL],reply_to:email,subject:"Website enquiry from "+clean(name),text:emailText})})}catch{return json({error:"Email service unavailable"},502)}
      if(!result.ok)return json({error:"Unable to submit enquiry right now"},502);
      return json({ok:true});
    }
    return env.ASSETS.fetch(request);
  }
};