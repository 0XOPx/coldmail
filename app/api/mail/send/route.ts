import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {encodeImpf} from "@/lib/impf";
const makeId=(p:string)=>p+"_"+crypto.randomUUID().replaceAll("-","");
const reply=(success:boolean,data:any,error:any=null,status=200)=>NextResponse.json({success,data,error,requestId:crypto.randomUUID()},{status});
export async function POST(req:Request){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)return reply(false,null,{code:"UNAUTHORIZED"},401);
 const input=await req.json().catch(()=>null);if(!input)return reply(false,null,{code:"INVALID"},400);
 const clean=(v:any)=>Array.isArray(v)?[...new Set(v.map(x=>String(x).trim().toLowerCase()).filter(Boolean))]:[];
 const to=clean(input.to),cc=clean(input.cc),bcc=clean(input.bcc);const all=[...to,...cc,...bcc];
 if(!to.length)return reply(false,null,{code:"INVALID",message:"At least one recipient is required"},400);
 if(all.length>100)return reply(false,null,{code:"RATE_LIMIT",message:"Recipient limit exceeded"},429);
 const overlap=new Set([...to.filter(x=>cc.includes(x)||bcc.includes(x)),...cc.filter(x=>bcc.includes(x))]);if(overlap.size)return reply(false,null,{code:"INVALID",message:"Recipient appears in multiple recipient fields"},400);
 const {data:sender}=await s.from("mail_addresses").select("address").eq("user_id",user.id).eq("is_primary",true).maybeSingle();if(!sender)return reply(false,null,{code:"NO_ADDRESS"},409);
 const {data:resolved,error:resolveError}=await s.schema("private").rpc("resolve_coldmail_recipients",{p_addresses:all});
 if(resolveError||!resolved||resolved.length!==all.length)return reply(false,null,{code:"RECIPIENT_NOT_FOUND",message:"One or more recipients do not exist"},404);
 const now=new Date().toISOString(),threadId=String(input.threadId||makeId("thr")),messageId=makeId("msg"),header="<"+messageId+"@coldmail.com>",subject=String(input.subject||"").slice(0,300),body=String(input.body||"").slice(0,500000);
 const attachmentIds=Array.isArray(input.attachmentIds)?input.attachmentIds.map(String).slice(0,20):[];
 const {data:ownedAttachments}=attachmentIds.length?await s.from("attachments").select("id,storage_path").in("id",attachmentIds).eq("owner_user_id",user.id):{data:[]};
 const attachments=(ownedAttachments||[]).map((x:any)=>x.storage_path);
 const raw=encodeImpf({version:"1.0",adressant:sender.address,to,cc,bcc,subject,date:now,messageId:header,inReplyTo:input.inReplyTo,threadId,contentType:"text/impf",body,attachments,priority:["low","normal","high"].includes(input.priority)?input.priority:"normal",labels:[]});
 let result=await s.from("threads").upsert({id:threadId,owner_user_id:user.id,subject,updated_at:now},{onConflict:"id"});if(result.error)return reply(false,null,{code:"FAILED",message:result.error.message},500);
 result=await s.from("messages").insert({id:messageId,sender_user_id:user.id,thread_id:threadId,subject,body,impf_raw:raw,message_id:header,in_reply_to:input.inReplyTo||null,sent_at:now});if(result.error)return reply(false,null,{code:"FAILED",message:result.error.message},500);
 if(attachmentIds.length){result=await s.from("attachments").update({message_id:messageId}).in("id",attachmentIds).eq("owner_user_id",user.id);if(result.error)return reply(false,null,{code:"FAILED",message:result.error.message},500)}
 const recipientRows=resolved.map((r:any)=>({message_id:messageId,recipient_user_id:r.user_id,address:r.address,kind:to.includes(r.address)?"to":cc.includes(r.address)?"cc":"bcc",folder:"inbox"}));
 recipientRows.push({message_id:messageId,recipient_user_id:user.id,address:sender.address,kind:"to",folder:"sent"});
 result=await s.from("message_recipients").insert(recipientRows);if(result.error)return reply(false,null,{code:"FAILED",message:result.error.message},500);
 const events=resolved.map((r:any)=>({message_id:messageId,recipient_user_id:r.user_id,event_type:"delivery",status:"Delivered",metadata:{protocol:"IMPF",version:"1.0"}}));
 await s.from("delivery_events").insert(events);
 return reply(true,{messageId,threadId,status:"Delivered"});
}