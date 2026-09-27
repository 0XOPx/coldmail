"use client";
import {useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import {Button,Input} from "@/components/ui";
export default function Login(){
 const[e,setE]=useState(""),[p,setP]=useState(""),[x,setX]=useState(""),[busy,setBusy]=useState(false);
 async function submit(v:React.FormEvent){
  v.preventDefault();setBusy(true);setX("");
  const {error}=await createClient().auth.signInWithPassword({email:e,password:p});
  if(error){setBusy(false);setX("We couldn't sign you in with those details.");return}
  const r=await fetch("/api/onboarding");const j=await r.json();
  location.href=j.data?.authenticated&&j.data.step!=="complete"?"/onboarding":"/mail";
 }
 return <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6"><form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-8 shadow-sm"><div className="text-sm font-black">coldmail</div><h1 className="text-3xl font-black">Welcome back</h1><Input required type="email" placeholder="Email" value={e} onChange={v=>setE(v.target.value)}/><Input required type="password" placeholder="Password" value={p} onChange={v=>setP(v.target.value)}/>{x&&<p className="text-sm text-red-600">{x}</p>}<Button className="w-full" disabled={busy}>{busy?"Signing in…":"Sign in"}</Button><Link className="block text-center text-sm" href="/auth/sign-up">Create account</Link></form></main>;
}