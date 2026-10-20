import {NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import {getDatabase} from "@/lib/db";
import {getUser,sameOrigin,getMembership} from "@/lib/auth";
import {type State,type Product} from "@/lib/model";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function fail(message:string):never{throw new Error(message)}
function positive(value:unknown,integer=false){if(typeof value!=="number"||!Number.isFinite(value)||value<=0||value>1e9||(integer&&!Number.isInteger(value)))fail("Enter a valid positive "+(integer?"whole number":"number"));return value as number}
export async function GET(){try{const user=await getUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});const membership=await getMembership(user.id);const {rows}=await getDatabase().query("SELECT state FROM erp_workspaces WHERE user_id=$1",[membership.workspace_id]);return NextResponse.json(rows[0].state,{headers:{"Cache-Control":"no-store"}})}catch{return NextResponse.json({error:"Unable to load cloud workspace. Check database availability."},{status:503})}}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
 try{const user=await getUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});const {action,payload:p}=await request.json();if(!p||typeof p!=="object")fail("Invalid record");
 const membership=await getMembership(user.id);const client=await getDatabase().connect();try{await client.query("BEGIN");const {rows}=await client.query("SELECT state FROM erp_workspaces WHERE user_id=$1 FOR UPDATE",[membership.workspace_id]);if(!rows[0])fail("Workspace not found");const s=rows[0].state as State;s.customers??=[];s.journals??=[];
 for(const b of s.bills){if(s.journals.some(j=>j.reference===b.id))continue;const amount=b.amount;const lines=b.kind==="Gatepass"?[{account:"Accounts receivable",debit:amount,credit:0},{account:"Sales",debit:0,credit:amount}]:b.kind==="Payment"?[{account:"Cash / Bank",debit:amount,credit:0},{account:"Accounts receivable",debit:0,credit:amount}]:[{account:"Operating expenses",debit:amount,credit:0},{account:"Cash / Bank",debit:0,credit:amount}];s.journals.push({id:randomUUID(),date:b.date,description:`${b.kind}: ${b.name}`,reference:b.id,lines});if(b.kind!=="Expense"&&!b.customerId){let c=s.customers.find(c=>c.name.toLowerCase()===b.name.toLowerCase());if(!c){c={id:randomUUID(),name:b.name,phone:""};s.customers.push(c)}b.customerId=c.id}}
 const post=(description:string,reference:string|undefined,lines:{account:string;debit:number;credit:number}[])=>{s.journals!.unshift({id:randomUUID(),date:new Date().toISOString(),description,reference,lines})};

 if(action==="size"){
 if(!["Slab","Girder"].includes(p.type))fail("Choose a valid product type");const length=positive(p.length),width=positive(p.width),height=p.type==="Girder"?positive(p.height):undefined;
 if(!Array.isArray(p.recipe)||p.recipe.length!==s.materials.length||p.recipe.some((v:unknown)=>typeof v!=="number"||!Number.isFinite(v)||v<0||v>1e9)||p.recipe.every((v:number)=>v===0))fail("Set a valid material estimate for every material");
 const old=s.stock.find(x=>x.id===p.id);if(p.id&&!old)fail("Product not found");if(old&&old.type!==p.type)fail("Product type cannot be changed");
 if(s.stock.some(x=>x.id!==p.id&&x.type===p.type&&x.length===length&&x.width===width&&x.height===height))fail("This size already exists");
 if(old&&s.entries.some(e=>e.productId===old.id||e.product===`${old.type} · ${old.size}${old.type==="Slab"?" ft":""}`)&&(old.length!==length||old.width!==width||old.height!==height))fail("This size has production history. Add a new size instead of changing its dimensions");
 const product:Product={id:old?.id??randomUUID(),type:p.type,length,width,height,size:p.type==="Girder"?`${width}″ × ${height}″ × ${length}′`:`${length} × ${width}`,stock:old?.stock??0,recipe:p.recipe,confirmed:p.confirmed===true};s.stock=old?s.stock.map(x=>x.id===old.id?product:x):[...s.stock,product];
 }else if(action==="material"){const q=positive(p.quantity);const m=s.materials.find(x=>x.name===p.product);if(!m)fail("Material not found");m.stock=Number((m.stock+q).toFixed(4));}
 else if(action==="production"){
 const q=positive(p.quantity,true);const product=s.stock.find(x=>x.id===p.product);if(!product)fail("Product not found");if(product.type==="Girder"&&(!product.width||!product.height))fail("Configure girder width and height first");if(!product.confirmed)fail("Confirm the factory dimensions and recipe in Stocks first");if(!product.recipe)fail("Set this product’s material estimates in Stocks first");const usage=product.recipe.map(n=>n*q);if(s.materials.some((m,i)=>m.stock+1e-8<usage[i]))fail("Insufficient raw material for this production batch");s.materials=s.materials.map((m,i)=>({...m,stock:Number(Math.max(0,m.stock-usage[i]).toFixed(4))}));product.stock+=q;
 s.entries.unshift({id:`PR-${randomUUID().slice(0,8).toUpperCase()}`,productId:product.id,product:`${product.type} · ${product.size}${product.type==="Slab"?" ft":""}`,quantity:q,date:new Date().toISOString()});
 }else if(action==="gatepass"||action==="expense"||action==="payment"){
 const q=positive(p.quantity,true),rate=positive(p.rate);const customer=s.customers.find(c=>c.id===p.customerId);const name=action==="expense"?String(p.name??"").trim():customer?.name??"";if(action!=="expense"&&!customer)fail("Select a customer from the customer register");if(name.length<2||name.length>200)fail("Enter a description or customer name (2–200 characters)");
 if(action==="gatepass"){const product=s.stock.find(x=>x.id===p.product);if(!product)fail("Product not found");if(product.stock<q)fail("Not enough finished stock available");product.stock-=q;}
 s.bills.unshift({id:`${action==="gatepass"?"GP":action==="payment"?"PM":"EX"}-${randomUUID().slice(0,8).toUpperCase()}`,customerId:customer?.id,name,amount:Number((q*rate).toFixed(2)),date:new Date().toISOString(),product:action==="gatepass"?`${s.stock.find(x=>x.id===p.product)?.type} · ${s.stock.find(x=>x.id===p.product)?.size}`:undefined,quantity:q,rate,kind:action==="gatepass"?"Gatepass":action==="payment"?"Payment":"Expense"});

 const amount=Number((q*rate).toFixed(2));const bill=s.bills[0];
 post(`${bill.kind}: ${name}`,bill.id,action==="gatepass"?[{account:"Accounts receivable",debit:amount,credit:0},{account:"Sales",debit:0,credit:amount}]:action==="payment"?[{account:"Cash / Bank",debit:amount,credit:0},{account:"Accounts receivable",debit:0,credit:amount}]:[{account:"Operating expenses",debit:amount,credit:0},{account:"Cash / Bank",debit:0,credit:amount}]);
 }else if(action==="customer"){
 const name=String(p.name??"").trim(),phone=String(p.phone??"").trim();if(name.length<2||name.length>120||phone.length>40)fail("Enter a valid customer name and phone");if(s.customers.some(c=>c.name.toLowerCase()===name.toLowerCase()))fail("Customer already exists");s.customers.push({id:randomUUID(),name,phone});
 }else if(action==="journal"){
 if(membership.role!=="owner")fail("Only the workspace owner can post manual journals");const description=String(p.description??"").trim();const accounts=["Cash / Bank","Accounts receivable","Raw material inventory","Finished goods inventory","Equipment","Accounts payable","Capital","Sales","Operating expenses","Cost of goods sold"];
 if(description.length<3||description.length>200||!Array.isArray(p.lines)||p.lines.length<2||p.lines.length>20)fail("Enter a journal description and at least two lines");
 let debit=0,credit=0;for(const line of p.lines){if(!accounts.includes(line.account)||typeof line.debit!=="number"||typeof line.credit!=="number"||!Number.isFinite(line.debit)||!Number.isFinite(line.credit)||line.debit<0||line.credit<0||(line.debit>0)===(line.credit>0))fail("Each journal line needs one valid debit or credit");line.debit=Math.round(line.debit*100)/100;line.credit=Math.round(line.credit*100)/100;debit+=Math.round(line.debit*100);credit+=Math.round(line.credit*100)}if(debit!==credit||debit===0)fail("Journal debits and credits must balance");if(p.lines.some((l:{account:string})=>l.account==="Accounts receivable"))fail("Use invoices and customer payments for receivable entries");post(description,undefined,p.lines);
 }else fail("Unknown action");
 await client.query("UPDATE erp_workspaces SET state=$2,updated_at=now() WHERE user_id=$1",[membership.workspace_id,JSON.stringify(s)]);await client.query("INSERT INTO erp_audit(user_id,action) VALUES($1,$2)",[user.id,action]);await client.query("COMMIT");return NextResponse.json(s,{headers:{"Cache-Control":"no-store"}});
 }catch(e){await client.query("ROLLBACK");const message=e instanceof Error?e.message:"Unable to save";if((e as {code?:string}).code)throw e;return NextResponse.json({error:message},{status:400})}finally{client.release()}
 }catch{return NextResponse.json({error:"Database unavailable. Please try again shortly."},{status:503})}
}
