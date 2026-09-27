"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/client";
import {Button} from "@/components/ui";
export default function Verify(){
 const router=useRouter(),[checking,setChecking]=useState(false),[email,setEmail]=useState(""),[message,setMessage]=useState("");
 useEffect(()=>{createClient().auth.getUser().then(({data})=>setEmail(data.user?.email||""))},[]);
 async function continueOnboarding(){
  setChecking(true);setMessage("");
  const {data,error}=await createClient().auth.getUser();
  if(error||!data.user){setChecking(false);setMessage("Your verification has not reached Coldmail yet. Open the confirmation email first, then try again.");return}
  router.replace("/onboarding");
 }
 return <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6"><section className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-sm"><div className="text-sm font-black">coldmail</div><h1 className="mt-8 text-4xl font-black tracking-tight">Verify your email</h1><p className="mt-3 text-zinc-500">We sent a confirmation link{email?" to "+email:""}. After you click it, come back here and continue.</p><Button className="mt-8 w-full" disabled={checking} onClick={continueOnboarding}>{checking?"Checking…":"I've verified my email"}</Button>{message&&<p className="mt-4 text-sm text-zinc-500">{message}</p>}</section></main>}