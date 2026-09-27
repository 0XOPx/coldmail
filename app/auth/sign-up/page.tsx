"use client";
import {useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import {Button,Input} from "@/components/ui";
export default function SignUp(){
 const[e,setE]=useState(""),[p,setP]=useState(""),[x,setX]=useState("");
 async function submit(v:React.FormEvent){
  v.preventDefault();setX("");
  if(p.length<8){setX("Password must be at least 8 characters.");return}
  const origin=window.location.origin;
  const {data,error}=await createClient().auth.signUp({email:e.trim(),password:p,options:{emailRedirectTo:origin+"/auth/callback?next=/auth/verify"}});
  if(error||!data.user){setX(error?.message??"Sign up failed");return}
  if(data.session){location.href="/onboarding";return}
  location.href="/auth/verify";
 }
 return <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6"><form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-8 shadow-sm"><div className="text-sm font-black">coldmail</div><h1 className="text-3xl font-black">Create your account</h1><p className="text-sm text-zinc-500">First create your login. Your @coldmail.com address comes next.</p><Input required type="email" placeholder="Account email" value={e} onChange={v=>setE(v.target.value)}/><Input required minLength={8} type="password" placeholder="Password" value={p} onChange={v=>setP(v.target.value)}/>{x&&<p className="text-sm text-red-600">{x}</p>}<Button className="w-full">Create account</Button><Link className="block text-center text-sm" href="/auth/login">Already have an account? Sign in</Link></form></main>;
}