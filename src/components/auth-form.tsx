"use client";
import {useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ArrowUpRight,Eye,EyeOff,LockKeyhole,Mail,UserRound,ShieldCheck} from "lucide-react";
import styles from "./auth-form.module.css";

export default function AuthForm({signup=false}:{signup?:boolean}){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[show,setShow]=useState(false);
 async function submit(form:FormData){
  if(busy)return;
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:signup?"signup":"login",name:form.get("name"),email:form.get("email"),password:form.get("password")})});
   const data=await response.json();if(!response.ok)throw new Error(data.error);
   router.replace("/");router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to sign in");setBusy(false)}
 }
 return <div className={styles.page}>
  <div className={styles.scene} aria-hidden="true"><div className={styles.orbOne}/><div className={styles.orbTwo}/><div className={styles.orbThree}/><div className={styles.ring}/></div>
  <div className={styles.topbar}>
   <Link href="/login" className={styles.brand} aria-label="Azad Concrete sign in"><span className={styles.logo}>ac<span>•</span></span><span className={styles.brandName}>AZAD<small>CONCRETE</small></span></Link>
   <span className={styles.access}><ShieldCheck size={14}/> Secure access</span>
  </div>
  <div className={styles.center}>
   <section className={styles.card} aria-labelledby="auth-title">
    <div className={styles.cardHead}><div><div className={styles.portal}>AZAD CONCRETE ERP</div><h1 id="auth-title">{signup?"Create account":"Welcome back"}</h1><p>{signup?"Enter your details to get started.":"Sign in to your account."}</p></div><span className={styles.glassIcon}><LockKeyhole size={20} strokeWidth={1.5}/></span></div>
    <form onSubmit={event=>{event.preventDefault();void submit(new FormData(event.currentTarget))}}>
     <fieldset disabled={busy} className={styles.fields}>
      {signup&&<div className={styles.field}><label htmlFor="auth-name">Full name</label><div className={styles.inputShell}><UserRound size={17}/><input id="auth-name" name="name" autoComplete="name" placeholder="Your full name" minLength={2} maxLength={80} required/></div></div>}
      <div className={styles.field}><label htmlFor="auth-email">Email address</label><div className={styles.inputShell}><Mail size={17}/><input id="auth-email" name="email" type="email" autoComplete="username" placeholder="you@company.com" maxLength={254} required/></div></div>
      <div className={styles.field}><label htmlFor="auth-password">Password</label><div className={styles.inputShell}><LockKeyhole size={17}/><input id="auth-password" name="password" type={show?"text":"password"} minLength={10} maxLength={128} autoComplete={signup?"new-password":"current-password"} placeholder={signup?"At least 10 characters":"Enter your password"} required/><button className={styles.eye} type="button" aria-label={show?"Hide password":"Show password"} aria-pressed={show} onClick={()=>setShow(!show)}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></div>
      {error&&<div className={styles.error} role="alert">{error}</div>}
      <button type="submit" className={styles.submit} disabled={busy}>{busy?"Please wait…":signup?"Create account":"Sign in"}<ArrowUpRight size={17}/></button>
     </fieldset>
    </form>
    <div className={styles.divider}/>
    <p className={styles.switch}>{signup?"Already have an account?":"Don’t have an account?"} <Link href={signup?"/login":"/signup"}>{signup?"Sign in":"Create account"}</Link></p>
   </section>
  </div>

 </div>
}
