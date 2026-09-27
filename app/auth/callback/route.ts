import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function GET(request:Request){
 const url=new URL(request.url);
 const code=url.searchParams.get("code");
 const next=url.searchParams.get("next")||"/auth/verify";
 const redirect=new URL(next,url.origin);
 const supabase=await createClient();
 if(code){
  const {error}=await supabase.auth.exchangeCodeForSession(code);
  if(!error)return NextResponse.redirect(redirect);
 }
 return NextResponse.redirect(new URL("/auth/verify",url.origin));
}