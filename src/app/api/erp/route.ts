import {NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import {getDatabase} from "@/lib/db";
import {getUser,sameOrigin} from "@/lib/auth";
import {type State,type Product} from "@/lib/model";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function fail(message:string):never{throw new Error(message)}
function positive(value:unknown,integer=false){if(typeof value!=="number"||!Number.isFinite(value)||value<=0||value>1e9||(integer&&!Number.isInteger(value)))fail("Enter a valid positive "+(integer?"whole number":"number"));return value as number}
export async function GET(){try{const user=await getUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});const {rows}=await getDatabase().query("SELECT state FROM erp_workspaces WHERE user_id=$1",[user.id]);return NextResponse.json(rows[0].state,{headers:{"Cache-Control":"no-store"}})}catch{return NextResponse.json({error:"Unable to load cloud workspace. Check database availability."},{status:503})}}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
 try{const user=await getUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});const {action,payload:p}=await request.json();if(!p||typeof p!=="object")fail("Invalid record");
 const client=await getDatabase().connect();try{await client.query("BEGIN");const {rows}=await client.query("SELECT state FROM erp_workspaces WHERE user_id=$1 FOR UPDATE",[user.id]);if(!rows[0])fail("Workspace not found");const s=rows[0].state as State;
 if(action==="size"){
 if(!["Slab","Girder"].includes(p.type))fail("Choose a valid product type");const length=positive(p.length),width=positive(p.width),height=p.type==="Girder"?positive(p.height):undefined;
 if(!Array.isArray(p.recipe)||p.recipe.length!==s.materials.length||p.recipe.some((v:unknown)=>typeof v!=="number"||!Number.isFinite(v)||v<0||v>1e9)||p.recipe.every((v:number)=>v===0))fail("Set a valid material estimate for every material");
 const old=s.stock.find(x=>x.id===p.id);if(p.id&&!old)fail("Product not found");if(old&&old.type!==p.type)fail("Product type cannot be changed");
 if(s.stock.some(x=>x.id!==p.id&&x.type===p.type&&x.length===length&&x.width===width&&x.height===height))fail("This size already exists");
 const product:Product={id:old?.id??randomUUID(),type:p.type,length,width,height,size:p.type==="Girder"?`${width}″ × ${height}″ × ${length}′`:`${length} × ${width}`,stock:old?.stock??0,recipe:p.recipe};s.stock=old?s.stock.map(x=>x.id===old.id?product:x):[...s.stock,product];
 }else if(action==="material"){const q=positive(p.quantity);const m=s.materials.find(x=>x.name===p.product);if(!m)fail("Material not found");m.stock=Number((m.stock+q).toFixed(4));}
 else if(action==="production"){
 const q=positive(p.quantity,true);const product=s.stock.find(x=>x.id===p.product);if(!product)fail("Product not found");if(product.type==="Girder"&&(!product.width||!product.height))fail("Configure girder width and height first");if(!product.recipe)fail("Set this product’s material estimates in Stocks first");const usage=product.recipe.map(n=>n*q);if(s.materials.some((m,i)=>m.stock+1e-8<usage[i]))fail("Insufficient raw material for this production batch");s.materials=s.materials.map((m,i)=>({...m,stock:Number(Math.max(0,m.stock-usage[i]).toFixed(4))}));product.stock+=q;
 s.entries.unshift({id:`PR-${randomUUID().slice(0,8).toUpperCase()}`,product:`${product.type} · ${product.size}${product.type==="Slab"?" ft":""}`,quantity:q,date:new Date().toISOString()});
 }else if(action==="gatepass"||action==="expense"||action==="payment"){
 const q=positive(p.quantity,true),rate=positive(p.rate);const name=String(p.name??"").trim();if(name.length<2||name.length>200)fail("Enter a description or customer name (2–200 characters)");
 if(action==="gatepass"){const product=s.stock.find(x=>x.id===p.product);if(!product)fail("Product not found");if(product.stock<q)fail("Not enough finished stock available");product.stock-=q;}
 s.bills.unshift({id:`${action==="gatepass"?"GP":action==="payment"?"PM":"EX"}-${randomUUID().slice(0,8).toUpperCase()}`,name,amount:Number((q*rate).toFixed(2)),date:new Date().toISOString(),product:action==="gatepass"?`${s.stock.find(x=>x.id===p.product)?.type} · ${s.stock.find(x=>x.id===p.product)?.size}`:undefined,quantity:q,rate,kind:action==="gatepass"?"Gatepass":action==="payment"?"Payment":"Expense"});
 }else fail("Unknown action");
 await client.query("UPDATE erp_workspaces SET state=$2,updated_at=now() WHERE user_id=$1",[user.id,JSON.stringify(s)]);await client.query("INSERT INTO erp_audit(user_id,action) VALUES($1,$2)",[user.id,action]);await client.query("COMMIT");return NextResponse.json(s,{headers:{"Cache-Control":"no-store"}});
 }catch(e){await client.query("ROLLBACK");const message=e instanceof Error?e.message:"Unable to save";if((e as {code?:string}).code)throw e;return NextResponse.json({error:message},{status:400})}finally{client.release()}
 }catch{return NextResponse.json({error:"Database unavailable. Please try again shortly."},{status:503})}
}
