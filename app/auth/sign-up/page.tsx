"use client";
import {useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import {Button,Input} from "@/components/ui";
export default function SignUp(){
 const[e,setE]=useState(""),[p,setP]=useState(""),[x,setX]=useState(""),[busy,setBusy]=useState(false);
 async function submit(v:React.FormEvent){
  v.preventDefault();setX("");setBusy(true);
  if(p.length<8){setBusy(false);setX("Password must be at least 8 characters.");return}
  const {data,error}=await createClient().auth.signUp({email:e.trim(),password:p,});
  if(error||!data.user){setBusy(false);setX(error?.message??"Sign up failed");return}
  if(!data.session){setBusy(false);setX("Account created, but email confirmation is still enabled in Supabase. Disable email confirmation for Coldmail, then try again.");return}
  location.href="/onboarding";
 }
 return <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6"><form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-8 shadow-sm"><div className="text-sm font-black">coldmail</div><h1 className="text-3xl font-black">Create your account</h1><p className="text-sm text-zinc-500">Create your login, then choose your @coldmail.com address. No email verification is required.</p><Input required type="email" placeholder="Account email" value={e} onChange={v=>setE(v.target.value)}/><Input required minLength={8} type="password" placeholder="Password" value={p} onChange={v=>setP(v.target.value)}/>{x&&<p className="text-sm text-red-600">{x}</p>}<Button className="w-full" disabled={busy}>{busy?"Creating…":"Create account"}</Button><Link className="block text-center text-sm" href="/auth/login">Already have an account? Sign in</Link></form></main>;
}