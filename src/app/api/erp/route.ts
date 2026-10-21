import {recordMaterial,recordGatepass,ReceiptPermissionError} from "@/lib/stock-records";
import {recordProductionOpening} from "@/lib/production-opening";
import {workspaceEtag} from "@/lib/workspace-etag";
import {validFactoryLogo} from "@/lib/cloudinary";
import {allowed,actionPermission} from "@/lib/permissions";
import {visibleState} from "@/lib/access-state";
import {NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import {getDatabase} from "@/lib/db";
import {getUser,sameOrigin,getMembership} from "@/lib/auth";
import {type State,type Product} from "@/lib/model";
import {money,accountBalance,ledgerAccounts} from "@/lib/finance";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function fail(message:string):never{throw new Error(message)}
function positive(value:unknown,integer=false){if(typeof value!=="number"||!Number.isFinite(value)||value<=0||value>1e9||(integer&&!Number.isInteger(value)))fail("Enter a valid positive "+(integer?"whole number":"number"));return value as number}
export async function GET(request:Request){try{
 const user=await getUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});const membership=await getMembership(user.id);
 const {rows}=await getDatabase().query("SELECT state,updated_at::text||':'||md5(state::text) AS revision FROM erp_workspaces WHERE user_id=$1",[membership.workspace_id]);if(!rows[0])return NextResponse.json({error:"Factory not found"},{status:404});
 const etag=workspaceEtag(membership,rows[0].revision),headers={"Cache-Control":"private, no-store","ETag":etag,"Vary":"Cookie"};
 if(request.headers.get("if-none-match")===etag)return new NextResponse(null,{status:304,headers});
 return NextResponse.json(visibleState(rows[0].state,membership),{headers});
 }catch{return NextResponse.json({error:"Unable to load cloud workspace. Check database availability."},{status:503})}}

export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
 try{const user=await getUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});const {action,payload:p}=await request.json();if(!p||typeof p!=="object")fail("Invalid record");
 let membership=await getMembership(user.id);if(!actionPermission[action]||!allowed(membership,actionPermission[action]))return NextResponse.json({error:"You do not have permission for this feature"},{status:403});const client=await getDatabase().connect();try{await client.query("BEGIN");const membershipRow=await client.query("SELECT workspace_id,role,COALESCE(permissions,'[]'::jsonb) AS permissions FROM erp_memberships WHERE user_id=$1 FOR SHARE",[user.id]);membership=membershipRow.rows[0];if(!membership||!allowed(membership,actionPermission[action])){await client.query("ROLLBACK");return NextResponse.json({error:"Your access has changed. Refresh to continue."},{status:403})}const {rows}=await client.query("SELECT state FROM erp_workspaces WHERE user_id=$1 FOR UPDATE",[membership.workspace_id]);if(!rows[0])fail("Workspace not found");const s=rows[0].state as State;s.customers??=[];s.journals??=[];s.assets??=[];s.openingBalances??=[];s.materialReceipts??=[];
 for(const b of s.bills){if(s.journals.some(j=>j.reference===b.id)||b.amount===0)continue;const amount=b.amount;const lines=b.kind==="Gatepass"?[{account:"Accounts receivable",debit:amount,credit:0},{account:"Sales",debit:0,credit:amount}]:b.kind==="Payment"?[{account:"Cash / Bank",debit:amount,credit:0},{account:"Accounts receivable",debit:0,credit:amount}]:[{account:"Operating expenses",debit:amount,credit:0},{account:"Cash / Bank",debit:0,credit:amount}];s.journals.push({id:randomUUID(),date:b.date,description:`${b.kind}: ${b.name}`,reference:b.id,lines});if(b.kind!=="Expense"&&!b.customerId){let c=s.customers.find(c=>c.name.toLowerCase()===b.name.toLowerCase());if(!c){c={id:randomUUID(),name:b.name,phone:""};s.customers.push(c)}b.customerId=c.id}}
 const post=(description:string,reference:string|undefined,lines:{account:string;debit:number;credit:number}[])=>{s.journals!.unshift({id:randomUUID(),date:new Date().toISOString(),description,reference,lines})};

 const amountValue=(value:unknown)=>{const n=positive(value);const rounded=money(n);if(rounded<=0)fail("Amount must be at least Rs. 0.01");return rounded};
 const funding=(value:unknown)=>{if(value!=="Cash"&&value!=="Bank")fail("Select Cash or Bank");return value as string};
 const spend=(account:string,amount:number)=>{if(accountBalance(s.journals!,account)+.001<amount)fail(`Insufficient ${account} balance. Record opening funds or receipts first`)};
 if(action==="settings"){
 const name=String(p.name??"").trim(),logo=String(p.logo??"");if(name.length<2||name.length>80)fail("Factory name must be 2–80 characters");if(!validFactoryLogo(logo,membership.workspace_id))fail("Upload a PNG, JPG or WebP logo from Factory settings");const address=String(p.address??"").trim(),phone=String(p.phone??"").trim(),invoiceNote=String(p.invoiceNote??"").trim();if(address.length>300||phone.length>40||invoiceNote.length>300)fail("Settings text exceeds the allowed length");s.settings={name,logo,address,phone,invoiceNote};
 }else if(action==="import-products"){
 if(!Array.isArray(p.ids)||p.ids.length<1||p.ids.length>100||p.ids.some((id:unknown)=>typeof id!=="string"))fail("Select product templates to import");const result=await client.query("SELECT product FROM erp_product_templates WHERE id=ANY($1::text[])",[p.ids]);if(result.rows.length!==new Set(p.ids).size)fail("Some templates no longer exist");let added=0;for(const row of result.rows){const t=row.product as Product;if(s.stock.some(x=>x.type===t.type&&x.length===t.length&&x.width===t.width&&x.height===t.height))continue;s.stock.push({...t,id:randomUUID(),stock:0,recipe:undefined,confirmed:false,salePrice:0,inventoryValue:0});added++}if(!added)fail("Selected sizes already exist in your stock list");
 }else if(action==="material-settings"){
 const m=s.materials.find(m=>m.name===p.name);if(!m)fail("Material not found");if(typeof p.detail!=="string"||p.detail.length>120)fail("Use a description under 120 characters");m.capacity=positive(p.capacity);m.detail=String(p.detail??"").slice(0,120);
 }else if(action==="funds"){
 const account=funding(p.account),amount=amountValue(p.amount),note=String(p.note??"").trim();if(note.length>200)fail("Use a note under 200 characters");post(`Owner funds added to ${account}${note?`: ${note}`:""}`,`FD-${randomUUID().slice(0,8).toUpperCase()}`,[{account,debit:amount,credit:0},{account:"Capital",debit:0,credit:amount}]);
 }else if(action==="opening"){
 const account=funding(p.account);if(s.openingBalances.includes(account))fail("Opening balance already recorded. Use a journal for corrections");const amount=amountValue(p.amount);post(`Opening ${account}`,undefined,[{account,debit:amount,credit:0},{account:"Capital",debit:0,credit:amount}]);s.openingBalances.push(account);
 }else if(action==="transfer"){
 const from=p.from==="Cash / Bank"?"Cash / Bank":funding(p.from),to=funding(p.to);if(from===to)fail("Choose different source and destination");const amount=amountValue(p.amount);spend(from,amount);post(`${from} to ${to} transfer`,undefined,[{account:to,debit:amount,credit:0},{account:from,debit:0,credit:amount}]);
 }else if(action==="asset"){
 const name=String(p.name??"").trim(),quantity=positive(p.quantity,true),value=amountValue(p.currentValue),purchase=Number(p.purchaseValue),date=String(p.purchaseDate??"");if(name.length<2||name.length>120||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||!Number.isFinite(purchase)||purchase<0||purchase>1e9)fail("Enter valid asset details");if(!["Working","Maintenance","Out of service"].includes(p.condition))fail("Choose asset condition");const old=s.assets.find(a=>a.id===p.id);if(p.id&&!old)fail("Asset not found");const id=old?.id??randomUUID();const asset={id,name,quantity,purchaseDate:date,purchaseValue:money(purchase),currentValue:value,condition:p.condition,notes:String(p.notes??"").slice(0,500)};
 if(old){const difference=money(value-old.currentValue);if(difference!==0)post(`Asset valuation: ${name}`,id,[{account:"Equipment",debit:Math.max(difference,0),credit:Math.max(-difference,0)},{account:"Asset revaluation",debit:Math.max(-difference,0),credit:Math.max(difference,0)}]);s.assets=s.assets.map(a=>a.id===id?asset:a)}else{const source=p.source==="existing"?"Capital":funding(p.source);if(source!=="Capital")spend(source,purchase);if(source!=="Capital"&&purchase!==value)fail("For a new paid purchase, current value must equal purchase cost. Revalue later");post(`Asset ${source==="Capital"?"opening":"purchase"}: ${name}`,id,[{account:"Equipment",debit:value,credit:0},{account:source,debit:0,credit:value}]);s.assets.push(asset)}
 }else if(action==="size"){
 if(!["Slab","Girder"].includes(p.type))fail("Choose a valid product type");const length=positive(p.length),width=positive(p.width),height=p.type==="Girder"?positive(p.height):undefined;
 const old=s.stock.find(x=>x.id===p.id);if(p.id&&!old)fail("Product not found");if(old&&old.type!==p.type)fail("Product type cannot be changed");
 if(s.stock.some(x=>x.id!==p.id&&x.type===p.type&&x.length===length&&x.width===width&&x.height===height))fail("This size already exists");
 if(old&&s.entries.some(e=>e.productId===old.id||e.product===`${old.type} · ${old.size}${old.type==="Slab"?" ft":""}`)&&(old.length!==length||old.width!==width||old.height!==height))fail("This size has production history. Add a new size instead of changing its dimensions");
 if(p.salePrice!==undefined&&(typeof p.salePrice!=="number"||!Number.isFinite(p.salePrice)||p.salePrice<0||p.salePrice>1e9))fail("Enter a valid sale price");
 const product:Product={id:old?.id??randomUUID(),type:p.type,length,width,height,size:p.type==="Girder"?`${width}″ × ${height}″ × ${length}′`:`${length} × ${width}`,stock:old?.stock??0,recipe:old?.recipe,confirmed:true,salePrice:p.salePrice===undefined?old?.salePrice??0:money(Number(p.salePrice)),inventoryValue:old?.inventoryValue??0};s.stock=old?s.stock.map(x=>x.id===old.id?product:x):[...s.stock,product];
 }else if(action==="material"){
 recordMaterial(s,p,post,spend);
 }else if(action==="production"){
 const q=positive(p.quantity,true),product=s.stock.find(x=>x.id===p.product);if(!product)fail("Product not found");if(product.type==="Girder"&&(!product.width||!product.height))fail("Configure girder width and height in Stocks first");if(product.stock+q>1e9)fail("Finished quantity is too large");product.stock+=q;
 s.entries.unshift({id:`PR-${randomUUID().slice(0,8).toUpperCase()}`,productId:product.id,product:`${product.type} · ${product.size}${product.type==="Slab"?" ft":""}`,quantity:q,date:new Date().toISOString()});
 }else if(action==="production-opening"){
 recordProductionOpening(s,p,user.name,post);
 }else if(action==="gatepass"){
 recordGatepass(s,p,post,allowed(membership,"accounts_manage"));
 }else if(action==="expense"||action==="payment"){
 const directAmount=p.amount!==undefined,q=directAmount?1:positive(p.quantity,true),rate=directAmount?amountValue(p.amount):positive(p.rate),amount=amountValue(q*rate),paymentAccount=funding(p.account);
 if(action==="expense")spend(paymentAccount,amount);const customer=s.customers.find(c=>c.id===p.customerId),name=action==="expense"?String(p.name??"").trim():customer?.name??"";if(action==="payment"&&!customer)fail("Select a customer from the customer register");if(name.length<2||name.length>200)fail("Enter a description or customer name (2–200 characters)");
 const bill={id:`${action==="payment"?"PM":"EX"}-${randomUUID().slice(0,8).toUpperCase()}`,paymentAccount,customerId:customer?.id,name,amount,date:new Date().toISOString(),quantity:q,rate,kind:action==="payment"?"Payment":"Expense"};s.bills.unshift(bill);
 post(`${bill.kind}: ${name}`,bill.id,action==="payment"?[{account:paymentAccount,debit:amount,credit:0},{account:"Accounts receivable",debit:0,credit:amount}]:[{account:"Operating expenses",debit:amount,credit:0},{account:paymentAccount,debit:0,credit:amount}]);
 }else if(action==="customer"){
 const name=String(p.name??"").trim(),phone=String(p.phone??"").trim();if(name.length<2||name.length>120||phone.length>40)fail("Enter a valid customer name and phone");const old=p.id?s.customers.find(c=>c.id===p.id):undefined;if(p.id&&!old)fail("Customer not found");const kind=p.kind??old?.kind??"dealer";if(kind!=="dealer"&&kind!=="walk-in")fail("Choose Dealer or Walk-in");if(kind==="dealer"&&s.customers.some(c=>c.id!==old?.id&&(c.kind??"dealer")==="dealer"&&c.name.toLowerCase()===name.toLowerCase()))fail("Dealer already exists");if(old){old.name=name;old.phone=phone;old.kind=kind}else s.customers.push({id:randomUUID(),name,phone,kind});
 }else if(action==="journal"){
 const description=String(p.description??"").trim();const accounts=ledgerAccounts;
 if(description.length<3||description.length>200||!Array.isArray(p.lines)||p.lines.length<2||p.lines.length>20)fail("Enter a journal description and at least two lines");
 let debit=0,credit=0;for(const line of p.lines){if(!accounts.includes(line.account)||typeof line.debit!=="number"||typeof line.credit!=="number"||!Number.isFinite(line.debit)||!Number.isFinite(line.credit)||line.debit<0||line.credit<0||(line.debit>0)===(line.credit>0))fail("Each journal line needs one valid debit or credit");line.debit=Math.round(line.debit*100)/100;line.credit=Math.round(line.credit*100)/100;debit+=Math.round(line.debit*100);credit+=Math.round(line.credit*100)}if(debit!==credit||debit===0)fail("Journal debits and credits must balance");if(p.lines.some((l:{account:string})=>["Equipment","Asset revaluation","Raw material inventory","Finished goods inventory","Cost of goods sold"].includes(l.account)))fail("Use asset and material workflows for inventory and asset values");if(p.lines.some((l:{account:string})=>l.account==="Accounts receivable"))fail("Use invoices and customer payments for receivable entries");for(const account of ["Cash","Bank","Cash / Bank"]){const net=p.lines.filter((l:{account:string})=>l.account===account).reduce((n:number,l:{debit:number;credit:number})=>n+l.debit-l.credit,0);if(accountBalance(s.journals!,account)+net<-.001)fail(`Journal would overdraw ${account}`)}post(description,undefined,p.lines);
 }else fail("Unknown action");
 const updated=await client.query("UPDATE erp_workspaces SET state=$2,updated_at=now() WHERE user_id=$1 RETURNING updated_at::text||':'||md5(state::text) AS revision",[membership.workspace_id,JSON.stringify(s)]);await client.query("INSERT INTO erp_audit(user_id,action) VALUES($1,$2)",[user.id,action]);await client.query("COMMIT");return NextResponse.json(visibleState(s,membership),{headers:{"Cache-Control":"private, no-store","ETag":workspaceEtag(membership,updated.rows[0].revision),"Vary":"Cookie"}});
 }catch(e){await client.query("ROLLBACK");const message=e instanceof Error?e.message:"Unable to save";if((e as {code?:string}).code)throw e;return NextResponse.json({error:message},{status:e instanceof ReceiptPermissionError?403:400})}finally{client.release()}
 }catch{return NextResponse.json({error:"Database unavailable. Please try again shortly."},{status:503})}
}
