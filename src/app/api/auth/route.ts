import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {randomUUID} from "node:crypto";
import {getDatabase} from "@/lib/db";
import {hashPassword,verifyPassword,createSession,hashToken,sameOrigin} from "@/lib/auth";
import {emptyState} from "@/lib/model";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
 try{const body=await request.json();const email=String(body.email??"").trim().toLowerCase(),password=String(body.password??""),name=String(body.name??"").trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<10||password.length>128)return NextResponse.json({error:"Use a valid email and a password of 10–128 characters."},{status:400});
 if(!["login","signup"].includes(body.mode))return NextResponse.json({error:"Invalid action"},{status:400});
 const db=getDatabase();const limitKey=hashToken(email+":"+body.mode);const limit=await db.query("INSERT INTO erp_auth_limits(key) VALUES($1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN erp_auth_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE erp_auth_limits.attempts+1 END,window_start=CASE WHEN erp_auth_limits.window_start<now()-interval '15 minutes' THEN now() ELSE erp_auth_limits.window_start END RETURNING attempts",[limitKey]);
 if(limit.rows[0].attempts>10)return NextResponse.json({error:"Too many attempts. Try again in 15 minutes."},{status:429});
 let userId:string;
 if(body.mode==="signup"){
 if(name.length<2||name.length>80)return NextResponse.json({error:"Enter your name (2–80 characters)."},{status:400});
 const client=await db.connect();try{await client.query("BEGIN");userId=randomUUID();await client.query("INSERT INTO erp_users(id,name,email,password_hash) VALUES($1,$2,$3,$4)",[userId,name,email,await hashPassword(password)]);await client.query("INSERT INTO erp_workspaces(user_id,state) VALUES($1,$2)",[userId,JSON.stringify(emptyState())]);await client.query("INSERT INTO erp_memberships(user_id,workspace_id,role) VALUES($1,$1,'owner')",[userId]);await client.query("COMMIT")}catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
 }else{const {rows}=await db.query("SELECT id,password_hash FROM erp_users WHERE email=$1",[email]);const fallback="00000000000000000000000000000000:"+"00".repeat(64);const valid=await verifyPassword(password,rows[0]?.password_hash??fallback);if(!rows[0]||!valid)return NextResponse.json({error:"Email or password is incorrect."},{status:401});userId=rows[0].id}
 await createSession(userId);return NextResponse.json({ok:true});
 }catch(e){const code=(e as {code?:string}).code;if(code==="23505")return NextResponse.json({error:"This email is already registered. Sign in instead."},{status:409});console.error("Authentication unavailable",code??"unknown");return NextResponse.json({error:"Database is not available yet. Wait for Aiven to finish building and run database setup."},{status:503})}
}
export async function DELETE(request:Request){if(!sameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});const token=(await cookies()).get("azad_session")?.value;try{if(token)await getDatabase().query("DELETE FROM erp_sessions WHERE token_hash=$1",[hashToken(token)]);}finally{(await cookies()).delete("azad_session")}return NextResponse.json({ok:true})}
