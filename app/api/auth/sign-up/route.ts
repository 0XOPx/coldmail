import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

const json=(data:unknown,status=200)=>NextResponse.json({success:status<400,data,error:null,requestId:crypto.randomUUID()}, {status});

export async function POST(request:Request){
  try{
    const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
    const body=await request.json();
    const email=String(body?.email||"").trim().toLowerCase();
    const password=String(body?.password||"");
    if(!/^\S+@\S+\.\S+$/.test(email)||password.length<8)return NextResponse.json({success:false,data:null,error:{code:"invalid_input",message:"Enter a valid email address and a password of at least 8 characters."},requestId:crypto.randomUUID()},{status:400});
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
    if(!url||!key)return NextResponse.json({success:false,data:null,error:{code:"server_configuration",message:"Signup is temporarily unavailable."},requestId:crypto.randomUUID()},{status:500});
    const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:allowed,error:limitError}=await admin.rpc("consume_signup_rate_limit",{p_key:"signup:"+ip,p_limit:5,p_window_seconds:3600});
    if(limitError||allowed!==true)return NextResponse.json({success:false,data:null,error:{code:"rate_limited",message:"Too many signup attempts. Try again later."},requestId:crypto.randomUUID()},{status:429});
    const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
    if(error||!data.user){
      const code=error?.code||"signup_failed";
      const message=code==="email_exists"?"An account with that email already exists.":"Unable to create the account.";
      return NextResponse.json({success:false,data:null,error:{code,message},requestId:crypto.randomUUID()},{status:code==="email_exists"?409:400});
    }
    return json({userId:data.user.id});
  }catch{
    return NextResponse.json({success:false,data:null,error:{code:"invalid_request",message:"Invalid signup request."},requestId:crypto.randomUUID()},{status:400});
  }
}