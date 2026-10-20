import "server-only";
import {cookies} from "next/headers";
import {createHash,randomBytes,scrypt as scryptCb,timingSafeEqual} from "node:crypto";
import {promisify} from "node:util";
import {getDatabase} from "./db";
import {type Role,type Permission} from "./permissions";
const scrypt=promisify(scryptCb);
export const hashToken=(token:string)=>createHash("sha256").update(token).digest("hex");
export async function hashPassword(password:string){const salt=randomBytes(16).toString("hex");const key=await scrypt(password,salt,64) as Buffer;return salt+":"+key.toString("hex")}
export async function verifyPassword(password:string,stored:string){const [salt,hex]=stored.split(":");const actual=await scrypt(password,salt,64) as Buffer;const expected=Buffer.from(hex,"hex");return actual.length===expected.length&&timingSafeEqual(actual,expected)}
export async function getUser(){const token=(await cookies()).get("azad_session")?.value;if(!token)return null;const {rows}=await getDatabase().query("SELECT u.id,u.name,u.email FROM erp_sessions s JOIN erp_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()",[hashToken(token)]);return rows[0] as {id:string;name:string;email:string}|undefined}
export async function createSession(userId:string){const token=randomBytes(32).toString("hex");await getDatabase().query("INSERT INTO erp_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",[hashToken(token),userId]);(await cookies()).set("azad_session",token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:604800})}
export function sameOrigin(request:Request){return request.headers.get("origin")===new URL(request.url).origin}

export async function getMembership(userId:string){const {rows}=await getDatabase().query("SELECT workspace_id,role,COALESCE(permissions,'[]'::jsonb) AS permissions FROM erp_memberships WHERE user_id=$1",[userId]);if(!rows[0])throw new Error("Workspace membership missing");return rows[0] as {workspace_id:string;role:Role;permissions:Permission[]}}
