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
  const r=await fetch("/api/auth/sign-up",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:e.trim(),password:p})});
  const j=await r.json();
  if(!r.ok){setBusy(false);setX(j.error?.message??"Sign up failed");return}
  const {error}=await createClient().auth.signInWithPassword({email:e.trim(),password:p});
  if(error){setBusy(false);setX("Account created, but automatic sign-in failed. Please sign in manually.");return}
  location.href="/onboarding";
 }
 return <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6"><form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-8 shadow-sm"><div className="text-sm font-black">coldmail</div><h1 className="text-3xl font-black">Create your account</h1><p className="text-sm text-zinc-500">Create your login, then choose your @coldmail.com address. No verification email is sent.</p><Input required type="email" placeholder="Account email" value={e} onChange={v=>setE(v.target.value)}/><Input required minLength={8} type="password" placeholder="Password" value={p} onChange={v=>setP(v.target.value)}/>{x&&<p className="text-sm text-red-600">{x}</p>}<Button className="w-full" disabled={busy}>{busy?"Creating…":"Create account"}</Button><Link className="block text-center text-sm" href="/auth/login">Already have an account? Sign in</Link></form></main>;
}