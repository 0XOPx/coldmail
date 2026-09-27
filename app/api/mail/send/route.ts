import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {encodeImpf} from "@/lib/impf";

const makeId=(prefix:string)=>prefix+"_"+crypto.randomUUID().replaceAll("-","");

export async function POST(req:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({success:false,error:{code:"UNAUTHORIZED",message:"Sign in required"}},{status:401});
  const input=await req.json().catch(()=>null);
  if(!input||!Array.isArray(input.to)||input.to.length===0) return NextResponse.json({success:false,error:{code:"INVALID",message:"At least one recipient is required"}},{status:400});
  const to=input.to.map((x:string)=>x.trim().toLowerCase()).filter(Boolean);
  const cc=(input.cc||[]).map((x:string)=>x.trim().toLowerCase()).filter(Boolean);
  const bcc=(input.bcc||[]).map((x:string)=>x.trim().toLowerCase()).filter(Boolean);
  const all=[...to,...cc,...bcc];
  if(all.length>100) return NextResponse.json({success:false,error:{code:"RATE_LIMIT",message:"Recipient limit exceeded"}},{status:429});
  const {data:sender}=await supabase.from("mail_addresses").select("address").eq("user_id",user.id).eq("is_primary",true).maybeSingle();
  if(!sender) return NextResponse.json({success:false,error:{code:"NO_ADDRESS",message:"No primary Coldmail address"}},{status:409});
  const {data:resolved}=await supabase.rpc("resolve_coldmail_recipients",{p_addresses:all});
  if(!resolved||resolved.length!==new Set(all).size) return NextResponse.json({success:false,error:{code:"RECIPIENT_NOT_FOUND",message:"One or more recipients do not exist"}},{status:404});
  const now=new Date().toISOString();
  const threadId=input.threadId||makeId("thr");
  const messageId=makeId("msg");
  const header="<"+messageId+"@coldmail.com>";
  const subject=String(input.subject||"").slice(0,300);
  const body=String(input.body||"").slice(0,500000);
  const raw=encodeImpf({version:"1.0",adressant:sender.address,to,cc,bcc,subject,date:now,messageId:header,inReplyTo:input.inReplyTo,threadId,contentType:"text/impf",body,attachments:[],priority:input.priority||"normal",labels:input.labels||[]});
  let result=await supabase.from("threads").upsert({id:threadId,owner_user_id:user.id,subject,updated_at:now},{onConflict:"id"});
  if(result.error) return NextResponse.json({success:false,error:{code:"FAILED",message:result.error.message}},{status:500});
  result=await supabase.from("messages").insert({id:messageId,sender_user_id:user.id,thread_id:threadId,subject,body,impf_raw:raw,message_id:header,in_reply_to:input.inReplyTo||null,sent_at:now});
  if(result.error) return NextResponse.json({success:false,error:{code:"FAILED",message:result.error.message}},{status:500});
  const recipientRows=resolved.map((r:{user_id:string;address:string})=>({message_id:messageId,recipient_user_id:r.user_id,address:r.address,kind:to.includes(r.address)?"to":cc.includes(r.address)?"cc":"bcc",folder:"inbox"}));
  recipientRows.push({message_id:messageId,recipient_user_id:user.id,address:sender.address,kind:"to",folder:"sent"});
  result=await supabase.from("message_recipients").insert(recipientRows);
  if(result.error) return NextResponse.json({success:false,error:{code:"FAILED",message:result.error.message}},{status:500});
  return NextResponse.json({success:true,data:{messageId,threadId,status:"Delivered"},requestId:crypto.randomUUID()});
}
