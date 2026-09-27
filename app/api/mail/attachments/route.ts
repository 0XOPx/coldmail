import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {safeFilename} from "@/lib/validation";
const MAX=25*1024*1024;
const allowed=new Set(["application/pdf","text/plain","text/csv","image/png","image/jpeg","image/webp","application/zip"]);
export async function POST(req:Request){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)return NextResponse.json({success:false,error:{code:"UNAUTHORIZED"}},{status:401});
 const form=await req.formData();const file=form.get("file");const messageId=String(form.get("messageId")||"");
 if(!(file instanceof File)||!messageId)return NextResponse.json({success:false,error:{code:"INVALID"}},{status:400});
 if(file.size>MAX)return NextResponse.json({success:false,error:{code:"PAYLOAD_TOO_LARGE"}},{status:413});
 if(!allowed.has(file.type))return NextResponse.json({success:false,error:{code:"UNSUPPORTED_TYPE"}},{status:415});
 const path=user.id+"/"+crypto.randomUUID()+"-"+safeFilename(file.name);
 const upload=await s.storage.from("mail-attachments").upload(path,file,{contentType:file.type,upsert:false});
 if(upload.error)return NextResponse.json({success:false,error:{code:"UPLOAD_FAILED",message:upload.error.message}},{status:500});
 const {data,error}=await s.from("attachments").insert({message_id:messageId,storage_path:path,file_name:safeFilename(file.name),mime_type:file.type,size_bytes:file.size}).select().single();
 if(error){await s.storage.from("mail-attachments").remove([path]);return NextResponse.json({success:false,error:{code:"FAILED",message:error.message}},{status:500})}
 return NextResponse.json({success:true,data,error:null,requestId:crypto.randomUUID()});
}
