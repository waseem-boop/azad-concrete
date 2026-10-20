import {NextResponse} from "next/server";
import {getUser,getMembership,sameOrigin} from "@/lib/auth";
import {allowed,type Access} from "@/lib/permissions";
import {getDatabase} from "@/lib/db";
import {logoFileType,uploadFactoryLogo} from "@/lib/cloudinary";
import {defaultSettings,type State} from "@/lib/model";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
 try{
  const user=await getUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
  const membership=await getMembership(user.id);if(!allowed(membership,"settings_manage"))return NextResponse.json({error:"Factory settings permission required"},{status:403});
  if(Number(request.headers.get("content-length"))>2200000)return NextResponse.json({error:"Choose a logo smaller than 2 MB"},{status:413});
  let form:FormData;try{form=await request.formData()}catch{return NextResponse.json({error:"Choose a PNG, JPG or WebP logo"},{status:400})}
  const file=form.get("file");if(!(file instanceof File)||!file.size)return NextResponse.json({error:"Choose a logo image"},{status:400});
  if(file.size>2000000)return NextResponse.json({error:"Choose a logo smaller than 2 MB"},{status:413});
  const bytes=Buffer.from(await file.arrayBuffer()),mime=logoFileType(bytes);
  if(!mime||mime!==file.type)return NextResponse.json({error:"Use a valid PNG, JPG or WebP image"},{status:400});
  let logo:string;try{logo=await uploadFactoryLogo(file,membership.workspace_id)}catch(e){return NextResponse.json({error:e instanceof Error&&e.name!=="TimeoutError"?e.message:"Logo upload timed out. Please try again."},{status:502})}
  const client=await getDatabase().connect();try{
   await client.query("BEGIN");
   const member=await client.query("SELECT workspace_id,role,COALESCE(permissions,'[]'::jsonb) AS permissions FROM erp_memberships WHERE user_id=$1 FOR SHARE",[user.id]);const current=member.rows[0] as (Access&{workspace_id:string})|undefined;
   if(!current||current.workspace_id!==membership.workspace_id||!allowed(current,"settings_manage")){await client.query("ROLLBACK");return NextResponse.json({error:"Your factory access changed. Refresh and try again."},{status:403})}
   const result=await client.query("SELECT state FROM erp_workspaces WHERE user_id=$1 FOR UPDATE",[current.workspace_id]);const state=result.rows[0]?.state as State|undefined;if(!state)throw new Error("Factory not found");
   state.settings={...(state.settings??{...defaultSettings,name:"Azad Concrete"}),logo};
   await client.query("UPDATE erp_workspaces SET state=$2,updated_at=now() WHERE user_id=$1",[current.workspace_id,JSON.stringify(state)]);
   await client.query("INSERT INTO erp_audit(user_id,action) VALUES($1,'logo')",[user.id]);await client.query("COMMIT");
   return NextResponse.json({logo},{headers:{"Cache-Control":"no-store"}});
  }catch{await client.query("ROLLBACK");return NextResponse.json({error:"Image uploaded but could not be saved. Please try again."},{status:503})}finally{client.release()}
 }catch{return NextResponse.json({error:"Unable to upload logo. Please try again shortly."},{status:503})}
}
