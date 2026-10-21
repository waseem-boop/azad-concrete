import env from '@next/env';import {Pool} from 'pg';import {randomBytes} from 'node:crypto';import assert from 'node:assert/strict';
env.loadEnvConfig(process.cwd());const base=process.env.TEST_BASE_URL||'http://localhost:3108',email=`opening-check-${randomBytes(6).toString('hex')}@example.test`,password=randomBytes(18).toString('hex');let cookie='';
const uri=new URL(process.env.DATABASE_URL);uri.searchParams.delete('sslmode');const db=new Pool({connectionString:uri.toString(),ssl:{rejectUnauthorized:true,ca:process.env.AIVEN_CA_CERT.replace(/\\n/g,'\n')},max:1});
async function req(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:base,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {r,d:await r.json()}}
const act=(action,payload)=>req('/api/erp',{action,payload});function check(v,label){assert.ok(v,label);console.log('PASS:',label)}const balance=(s,a)=>Math.round(s.journals.reduce((n,j)=>n+j.lines.filter(l=>l.account===a).reduce((n,l)=>n+l.debit-l.credit,0),0)*100)/100;
try{
 let x=await req('/api/auth',{mode:'signup',name:'Opening Check',email,password});check(x.r.ok,'temporary signup');cookie=x.r.headers.get('set-cookie').split(';')[0];
 x=await act('import-products',{ids:['S0']});check(x.r.ok,'import slab size');const product=x.d.stock[0].id;
 x=await act('production',{product,quantity:20});check(x.r.ok&&x.d.stock[0].availableStock===0,'20 produced slabs are unavailable before opening');const batchId=x.d.entries[0].id;
 x=await act('customer',{name:'Opening Dealer',phone:''});check(x.r.ok,'customer creation preserved');const customerId=x.d.customers[0].id;
 x=await act('gatepass',{customerId,items:[{product,quantity:1,rate:1000}],availableStock:999999});check(x.r.status===400,'API rejects pending slab sale even with forged availability');
 // Backdate only the disposable factory's batch to model opening after three days.
 const {rows}=await db.query('SELECT w.user_id,w.state FROM erp_workspaces w JOIN erp_users u ON u.id=w.user_id WHERE u.email=$1',[email]);const s=rows[0].state;s.entries[0].date=new Date(Date.now()-3*86400000).toISOString();await db.query('UPDATE erp_workspaces SET state=$2 WHERE user_id=$1',[rows[0].user_id,JSON.stringify(s)]);
 for(const route of ['/stocks','/production',`/production/${batchId}`]){const r=await fetch(base+route,{headers:{Cookie:cookie}}),html=await r.text();check(r.ok&&html.includes(route==='/stocks'?'Slab production &amp; openings':'Production openings'),`dedicated route ${route}`)}
 const date=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'}),opening={batchId,date,good:15,damaged:5,note:'Five damaged after opening'};
 x=await act('production-opening',opening);check(x.r.ok&&x.d.stock[0].availableStock===15&&x.d.stock[0].stock===15&&x.d.entries[0].quantity===20&&x.d.entries[0].opening.damaged===5,'opening deducts five damaged slabs and retains produced quantity');
 x=await act('production-opening',opening);check(x.r.ok&&x.d.stock[0].stock===15,'repeat opening save never deducts twice');
 x=await act('production-opening',{...opening,good:16,damaged:4});check(x.r.status===400,'changed results cannot overwrite finalized opening');
 x=await req('/api/erp');check(x.d.entries[0].opening.date===date&&x.d.entries[0].opening.good===15&&x.d.entries[0].opening.note===opening.note,'opening results persist after reload');
 x=await act('gatepass',{customerId,items:[{product,quantity:10,rate:10000}],payment:{status:'partial',method:'Split',cash:20000,bank:50000}});check(x.r.ok&&x.d.stock[0].stock===5&&balance(x.d,'Cash')===20000&&balance(x.d,'Bank')===50000&&balance(x.d,'Accounts receivable')===30000,'gatepass, stock and split payment work after damage adjustment');
 const invoice=x.d.bills.find(b=>b.kind==='Gatepass');check(invoice.settlement.remaining===30000,'invoice shows remaining credit');
 x=await act('payment',{customerId,amount:30000,account:'Bank'});check(x.r.ok&&balance(x.d,'Accounts receivable')===0&&x.d.bills.find(b=>b.id===invoice.id).settlement.status==='paid','existing payment collection clears remaining invoice credit');
 x=await act('production',{product,quantity:20});check(x.r.ok&&x.d.stock[0].stock===25,'new production still adds finished stock');const next=x.d.entries[0].id;
 x=await act('production-opening',{batchId:next,date,good:10,damaged:11});check(x.r.status===400,'incorrect good/damage total rejected');
 x=await act('gatepass',{customerId,items:[{product,quantity:22,rate:100}]});check(x.r.status===400,'API cannot dispatch pending slabs alongside opened stock');
 x=await act('gatepass',{customerId,items:[{product,quantity:5,rate:100}]});check(x.r.ok&&x.d.stock[0].stock===20&&x.d.stock[0].availableStock===0,'only remaining opened stock can be dispatched');
 x=await act('production-opening',{batchId:next,date,good:15,damaged:5});check(x.r.ok&&x.d.stock[0].availableStock===15,'opening new batch releases its good slabs');
 x=await req('/api/erp');check(x.d.stock[0].stock===15&&x.d.entries.find(e=>e.id===next).opening.damaged===5,'stock and opening quantities persist correctly');
 const anonymous=await fetch(base+`/production/${batchId}`,{redirect:'manual'});check(anonymous.status===307&&anonymous.headers.get('location')==='/login','opening detail route requires login');
 check(x.d.journals.every(j=>Math.round(j.lines.reduce((n,l)=>n+l.debit-l.credit,0)*100)===0),'all accounting postings still balance');
}finally{await db.query('DELETE FROM erp_audit WHERE user_id IN(SELECT id FROM erp_users WHERE email=$1)',[email]);await db.query('DELETE FROM erp_users WHERE email=$1',[email]);await db.end();console.log('Temporary opening account cleaned up')}
