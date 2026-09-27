import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function GET(req:Request){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();
 if(!user)return NextResponse.json({success:false,error:{code:"UNAUTHORIZED"}},{status:401});
 const u=new URL(req.url);const folder=u.searchParams.get("folder")||"inbox";const q=u.searchParams.get("q")||"";const limit=Math.min(Math.max(Number(u.searchParams.get("limit")||50),1),100);
 let query=s.from("message_recipients").select("id,message_id,folder,is_read,is_starred,kind,address,created_at,messages(id,subject,body,message_id,in_reply_to,thread_id,sent_at,sender_user_id)").eq("recipient_user_id",user.id).eq("folder",folder).order("created_at",{ascending:false}).limit(limit);
 if(q)query=query.ilike("address","%"+q+"%");
 const {data,error}=await query;
 return NextResponse.json({success:!error,data:data||[],error:error?{code:"FAILED",message:error.message}:null,requestId:crypto.randomUUID()},{status:error?500:200});
}
export async function PATCH(req:Request){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)return NextResponse.json({success:false},{status:401});
 const b=await req.json();const allowed=new Set(["is_read","is_starred","folder"]);const patch:Object={};for(const k of Object.keys(b))if(allowed.has(k))patch[k]=b[k];
 const {data,error}=await s.from("message_recipients").update(patch).eq("id",b.id).eq("recipient_user_id",user.id).select().single();
 return NextResponse.json({success:!error,data,error:error?{code:"FAILED",message:error.message}:null,requestId:crypto.randomUUID()},{status:error?500:200});
}