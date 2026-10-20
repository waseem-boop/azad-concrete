import {NextResponse} from "next/server";
import {randomBytes} from "node:crypto";
import {getUser,getMembership,hashToken,sameOrigin} from "@/lib/auth";
import {getDatabase} from "@/lib/db";
import {normalizePermissions,rolePresets,type Role} from "@/lib/permissions";
export const dynamic="force-dynamic";
export async function GET(){try{
 const u=await getUser();if(!u)return NextResponse.json({error:"Sign in required"},{status:401});const m=await getMembership(u.id);
 const members=await getDatabase().query("SELECT u.name,u.email,m.role,COALESCE(m.permissions,'[]'::jsonb) AS permissions FROM erp_memberships m JOIN erp_users u ON u.id=m.user_id WHERE workspace_id=$1 AND ($2 OR m.user_id=$3) ORDER BY (role='owner') DESC,email",[m.workspace_id,m.role==="owner",u.id]);
 return NextResponse.json({role:m.role,permissions:m.permissions,members:members.rows},{headers:{"Cache-Control":"no-store"}})
 }catch{return NextResponse.json({error:"Unable to load team"},{status:503})}}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});
 try{const u=await getUser();if(!u)return NextResponse.json({error:"Sign in required"},{status:401});const p=await request.json();const c=await getDatabase().connect();try{
  await c.query("BEGIN");
  const result=await c.query("SELECT workspace_id,role FROM erp_memberships WHERE user_id=$1 FOR UPDATE",[u.id]);const m=result.rows[0];if(!m)throw new Error("Membership missing");
  if(p.action==="join"){
   const token=String(p.token??""),invites=await c.query("SELECT * FROM erp_invites WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE",[hashToken(token)]),invite=invites.rows[0];
   if(!invite||invite.email!==u.email)throw new Error("Invite is invalid, expired, or belongs to another email");
   if(m.workspace_id===invite.workspace_id)throw new Error("You already belong to this factory");
   const state=await c.query("SELECT state FROM erp_workspaces WHERE user_id=$1 FOR UPDATE",[u.id]);const s=state.rows[0]?.state;
   if(m.role!=="owner"||!s||s.entries.length||s.bills.length||s.stock.some((p:{stock:number})=>p.stock!==0)||s.materials.some((p:{stock:number})=>p.stock!==0)||(s.customers?.length??0)||(s.journals?.length??0)||(s.assets?.length??0)||(s.materialReceipts?.length??0))throw new Error("Join from a fresh account with no business records. Existing data cannot be moved automatically.");
   const others=await c.query("SELECT 1 FROM erp_memberships WHERE workspace_id=$1 AND user_id<>$1",[u.id]);if(others.rowCount)throw new Error("An owner with team members cannot switch factories");
   const owner=await c.query("SELECT 1 FROM erp_memberships WHERE user_id=$1 AND workspace_id=$1 AND role='owner'",[invite.workspace_id]);if(!owner.rowCount)throw new Error("This invitation is no longer available");
   await c.query("UPDATE erp_memberships SET workspace_id=$2,role=$3,permissions=$4 WHERE user_id=$1",[u.id,invite.workspace_id,invite.role,JSON.stringify(normalizePermissions(invite.permissions))]);
   await c.query("UPDATE erp_invites SET used_at=now() WHERE email=$1 AND used_at IS NULL",[u.email]);
   await c.query("DELETE FROM erp_invites WHERE workspace_id=$1 AND used_at IS NULL",[u.id]);
   await c.query("COMMIT");return NextResponse.json({ok:true});
  }
  if(!["invite","update","remove"].includes(p.action))throw new Error("Unknown action");
  if(m.role!=="owner"){await c.query("ROLLBACK");return NextResponse.json({error:"Only the factory owner can manage team access"},{status:403})}
  const email=String(p.email??"").trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email===u.email)throw new Error("Enter another team member's valid email. Owner access cannot be changed.");
  if(p.action==="remove"){
   const removed=await c.query("UPDATE erp_memberships SET workspace_id=user_id,role='owner',permissions='[]'::jsonb WHERE workspace_id=$1 AND role<>'owner' AND user_id=(SELECT id FROM erp_users WHERE email=$2) RETURNING user_id",[m.workspace_id,email]);if(!removed.rowCount)throw new Error("Team member not found");
   await c.query("DELETE FROM erp_invites WHERE workspace_id=$1 AND email=$2 AND used_at IS NULL",[m.workspace_id,email]);await c.query("COMMIT");return NextResponse.json({ok:true});
  }
  if(!["staff","cashier","manager"].includes(p.role))throw new Error("Choose Staff, Cashier or Manager");
  const role=p.role as Exclude<Role,"owner">,permissions=normalizePermissions(p.permissions??rolePresets[role]);
  if(p.action==="update"){
   const updated=await c.query("UPDATE erp_memberships SET role=$3,permissions=$4 WHERE workspace_id=$1 AND role<>'owner' AND user_id=(SELECT id FROM erp_users WHERE email=$2) RETURNING user_id",[m.workspace_id,email,role,JSON.stringify(permissions)]);if(!updated.rowCount)throw new Error("Team member not found");await c.query("COMMIT");return NextResponse.json({ok:true});
  }
  const existing=await c.query("SELECT 1 FROM erp_memberships m JOIN erp_users u ON u.id=m.user_id WHERE m.workspace_id=$1 AND u.email=$2",[m.workspace_id,email]);if(existing.rowCount)throw new Error("This member already belongs to your factory. Use Edit access.");
  const token=randomBytes(32).toString("hex");await c.query("DELETE FROM erp_invites WHERE workspace_id=$1 AND email=$2 AND used_at IS NULL",[m.workspace_id,email]);
  await c.query("INSERT INTO erp_invites(token_hash,workspace_id,email,role,permissions) VALUES($1,$2,$3,$4,$5)",[hashToken(token),m.workspace_id,email,role,JSON.stringify(permissions)]);await c.query("COMMIT");return NextResponse.json({token,role,permissions});
 }catch(e){await c.query("ROLLBACK");if((e as {code?:string}).code)throw e;return NextResponse.json({error:e instanceof Error?e.message:"Unable to update team"},{status:400})}finally{c.release()}
 }catch{return NextResponse.json({error:"Unable to update team"},{status:503})}
}
