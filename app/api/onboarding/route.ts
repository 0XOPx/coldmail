import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
const reply=(success:boolean,data:any,error:any=null,status=200)=>NextResponse.json({success,data,error,requestId:crypto.randomUUID()},{status});
export async function GET(){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();
 if(!user)return reply(true,{authenticated:false,step:"verify"});
 const {data:profile,error}=await s.from("profiles").select("display_name,onboarding_complete,onboarding_completed_at").eq("id",user.id).single();
 if(error)return reply(false,null,{code:"FAILED"},500);
 const {data:address}=await s.from("mail_addresses").select("address,username,is_primary").eq("user_id",user.id).eq("is_primary",true).maybeSingle();
 const {data:tos}=await s.from("legal_acceptances").select("version").eq("user_id",user.id).eq("document","tos").eq("version","1.0").maybeSingle();
 const step=profile.onboarding_complete?"complete":!address?"address":!tos?"tos":"profile";
 return reply(true,{authenticated:true,step,profile,address,tos:!!tos});
}
export async function POST(req:Request){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();
 if(!user)return reply(true,{next:"/auth/verify"});
 const body=await req.json().catch(()=>null);const step=String(body?.step||"");
 if(step==="address"){
  const username=String(body?.username||"").toLowerCase().trim();
  const displayName=String(body?.displayName||username).trim();
  if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username))return reply(false,null,{code:"INVALID_USERNAME",message:"Use 3–32 letters, numbers, dots, underscores, or hyphens."},400);
  const {data,error}=await s.rpc("create_coldmail_identity",{p_user_id:user.id,p_username:username,p_display_name:displayName});
  if(error)return reply(false,null,{code:error.message.includes("username_taken")?"USERNAME_TAKEN":"ADDRESS_UNAVAILABLE",message:error.message.includes("username_taken")?"That address is already taken.":"That address could not be created."},409);
  return reply(true,{address:data});
 }
 if(step==="profile"){
  const displayName=String(body?.displayName||"").trim().slice(0,120);
  const {data,error}=await s.from("profiles").update({display_name:displayName,updated_at:new Date().toISOString()}).eq("id",user.id).select("display_name").single();
  return reply(!error,data,error?{code:"FAILED"}:null,error?500:200);
 }
 if(step==="tos"){
  if(body?.accepted!==true)return reply(false,null,{code:"TOS_REQUIRED",message:"You need to accept the Terms of Service to continue."},400);
  const {data,error}=await s.from("legal_acceptances").upsert({user_id:user.id,document:"tos",version:"1.0"},{onConflict:"user_id,document,version"}).select().single();
  return reply(!error,data,error?{code:"FAILED"}:null,error?500:200);
 }
 if(step==="complete"){
  const {data:address}=await s.from("mail_addresses").select("id").eq("user_id",user.id).eq("is_primary",true).maybeSingle();
  const {data:tos}=await s.from("legal_acceptances").select("id").eq("user_id",user.id).eq("document","tos").eq("version","1.0").maybeSingle();
  if(!address||!tos)return reply(false,null,{code:"INCOMPLETE",message:"Finish the onboarding steps first."},400);
  const now=new Date().toISOString();
  const {data,error}=await s.from("profiles").update({onboarding_complete:true,onboarding_completed_at:now,updated_at:now}).eq("id",user.id).select("onboarding_complete").single();
  if(error)return reply(false,null,{code:"FAILED"},500);
  const folders=[["Inbox","inbox"],["Sent","sent"],["Drafts","drafts"],["Archive","archive"],["Spam","spam"],["Trash","trash"]];
  const folderResult=await s.from("folders").upsert(folders.map(([name,slug])=>({user_id:user.id,name,slug})),{onConflict:"user_id,slug"});
  if(folderResult.error)return reply(false,null,{code:"FAILED"},500);
  return reply(true,{complete:true,profile:data});
 }
 return reply(false,null,{code:"INVALID_STEP"},400);
}