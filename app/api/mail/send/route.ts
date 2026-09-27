import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {encodeImpf} from "@/lib/impf";
import {safeFilename} from "@/lib/validation";
const makeId=(p:string)=>p+"_"+crypto.randomUUID().replaceAll("-","");
const reply=(success:boolean,data:any,error:any=null,status=200)=>NextResponse.json({success,data,error,requestId:crypto.randomUUID()});
export async function POST(req:Request){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)return reply(false,null,{code:"UNAUTHORIZED"},401);
 let input:any={};let files:File[]=[];
 if(req.headers.get("content-type")?.includes("multipart/form-data")){const f=await req.formData();input=JSON.parse(String(f.get("payload")||"{}"));files=f.getAll("files").filter((x):x is File=>x instanceof File)}else input=await req.json().catch(()=>null);
 if(!input)return reply(false,null,{code:"INVALID"},400);
 const clean=(v:any)=>Array.isArray(v)?[...new Set(v.map(x=>String(x).trim().toLowerCase()).filter(Boolean))]:[];
 const to=clean(input.to),cc=clean(input.cc),bcc=clean(input.bcc),all=[...to,...cc,...bcc];
 if(!to.length)return reply(false,null,{code:"INVALID"},400);if(all.length>100)return reply(false,null,{code:"RATE_LIMIT"},429);
 const overlap=new Set([...to.filter(x=>cc.includes(x)||bcc.includes(x)),...cc.filter(x=>bcc.includes(x))]);if(overlap.size)return reply(false,null,{code:"INVALID",message:"Duplicate recipient across fields"},400);
 const {data:sender}=await s.from("mail_addresses").select("address").eq("user_id",user.id).eq("is_primary",true).maybeSingle();if(!sender)return reply(false,null,{code:"NO_ADDRESS"},409);
 const {data:resolved,error:resolveError}=await s.rpc("resolve_coldmail_recipients",{p_addresses:all});if(resolveError)return reply(false,null,{code:"FAILED",message:"Recipient lookup failed"},500);if(!resolved||resolved.length!==all.length)return reply(false,null,{code:"RECIPIENT_NOT_FOUND"},404);
 const allowed=new Set(["application/pdf","text/plain","text/csv","image/png","image/jpeg","image/webp","application/zip"]);if(files.length>10||files.some(f=>f.size>25*1024*1024))return reply(false,null,{code:"PAYLOAD_TOO_LARGE"},413);if(files.some(f=>!allowed.has(f.type)))return reply(false,null,{code:"UNSUPPORTED_TYPE"},415);
 const now=new Date().toISOString(),threadId=String(input.threadId||makeId("thr")),messageId=makeId("msg"),header="<"+messageId+"@coldmail.com>",subject=String(input.subject||"").slice(0,300),body=String(input.body||"").slice(0,500000);
 const uploaded:{path:string;file:File}[]=[];for(const file of files){const path=user.id+"/"+crypto.randomUUID()+"-"+safeFilename(file.name);const up=await s.storage.from("attachments").upload(path,file,{contentType:file.type,upsert:false});if(up.error){await s.storage.from("attachments").remove(uploaded.map(x=>x.path));return reply(false,null,{code:"UPLOAD_FAILED"},500)}uploaded.push({path,file})}
 const ids=Array.isArray(input.attachmentIds)?input.attachmentIds.map(String).slice(0,20):[];const {data:existing}=ids.length?await s.from("attachments").select("id,storage_path").in("id",ids).eq("owner_user_id",user.id):{data:[]};const paths=[...(existing||[]).map((x:any)=>x.storage_path),...uploaded.map(x=>x.path)];
 const raw=encodeImpf({version:"1.0",adressant:sender.address,to,cc,bcc,subject,date:now,messageId:header,inReplyTo:input.inReplyTo,threadId,contentType:"text/impf",body,attachments:paths,priority:["low","normal","high"].includes(input.priority)?input.priority:"normal",labels:[]});
 let result=await s.from("threads").upsert({id:threadId,owner_user_id:user.id,subject,updated_at:now},{onConflict:"id"});if(result.error)return reply(false,null,{code:"FAILED"},500);
 result=await s.from("messages").insert({id:messageId,sender_user_id:user.id,thread_id:threadId,subject,body,impf_raw:raw,message_id:header,in_reply_to:input.inReplyTo||null,sent_at:now});if(result.error)return reply(false,null,{code:"FAILED"},500);
 if(uploaded.length){result=await s.from("attachments").insert(uploaded.map(x=>({message_id:messageId,owner_user_id:user.id,storage_path:x.path,filename:safeFilename(x.file.name),mime_type:x.file.type,size_bytes:x.file.size})));if(result.error)return reply(false,null,{code:"FAILED"},500)}
 if(ids.length){result=await s.from("attachments").update({message_id:messageId}).in("id",ids).eq("owner_user_id",user.id);if(result.error)return reply(false,null,{code:"FAILED"},500)}
 const recipientRows=resolved.map((r:any)=>({message_id:messageId,recipient_user_id:r.user_id,address:r.address,kind:to.includes(r.address)?"to":cc.includes(r.address)?"cc":"bcc",folder:"inbox"}));recipientRows.push({message_id:messageId,recipient_user_id:user.id,address:sender.address,kind:"to",folder:"sent"});
 result=await s.from("message_recipients").insert(recipientRows);if(result.error)return reply(false,null,{code:"FAILED"},500);
 await s.from("delivery_events").insert(resolved.map((r:any)=>({message_id:messageId,recipient_user_id:r.user_id,event_type:"delivery",status:"Delivered",metadata:{protocol:"IMPF",version:"1.0"}})));
 return reply(true,{messageId,threadId,status:"Delivered"});
}