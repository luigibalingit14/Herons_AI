"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isAllowedEmail } from "@/lib/auth/allowed-email";
import { UmakBrand } from "@/components/layout/UmakBrand";

export default function LoginPage() {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setError("");if(!isAllowedEmail(email)){setError("Use your @umak.edu.ph account.");return;}setBusy(true);const {error}=await createClient().auth.signInWithPassword({email,password});if(error){setError(error.message);}else{window.location.href="/dashboard";}setBusy(false);};
  return <section className="auth-card card"><Link className="auth-back" href="/">← Back to landing page</Link><UmakBrand/><h1>Welcome back</h1><p className="muted">Sign in with your @umak.edu.ph account</p>{error&&<p className="error" role="alert">{error}</p>}<form className="auth-form" onSubmit={submit}><label className="label">Email<input className="input" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="label">Password<input className="input" type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="button" disabled={busy}>{busy?"Signing in…":"Sign in"}</button></form><p className="muted">New here? <Link href="/signup" style={{color:"var(--yellow)"}}>Create an account</Link></p></section>;
}
