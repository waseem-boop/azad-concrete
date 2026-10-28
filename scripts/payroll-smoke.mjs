import env from '@next/env';
import {Pool} from 'pg';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
env.loadEnvConfig(process.cwd());
const base=process.env.TEST_BASE_URL||'http://localhost:3114',tag=randomBytes(6).toString('hex'),emails=[`payroll-${tag}@example.test`,`payroll-other-${tag}@example.test`],password=randomBytes(18).toString('hex'),cookies=[];
const uri=new URL(process.env.DATABASE_URL);for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])uri.searchParams.delete(key);
const db=new Pool({connectionString:uri.toString(),ssl:{rejectUnauthorized:true,ca:process.env.AIVEN_CA_CERT?.replace(/\\n/g,'\n')},max:1,connectionTimeoutMillis:15000});
async function req(i,path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:base,...(cookies[i]?{Cookie:cookies[i]}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {r,d:await r.json()}}
const act=(i,action,payload)=>req(i,'/api/erp',{action,payload});
const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'});
try{
 for(let i=0;i<2;i++){const x=await req(i,'/api/auth',{mode:'signup',name:'Payroll Check',email:emails[i],password});assert.equal(x.r.status,200,JSON.stringify(x.d));cookies[i]=x.r.headers.get('set-cookie').split(';')[0]}
 const initial=(await req(0,'/api/erp')).d;
 const fields={kind:'employee',name:'Employee Test',designation:'Operator',phone:'03001234567',joiningDate:today,salary:30000,active:true};
 let x=await act(0,'worker',{...fields,requestId:randomUUID()});assert.equal(x.r.status,200);const employee=x.d.payroll.workers[0];
 x=await act(0,'worker',{...fields,kind:'thakedaar',name:'Thakedaar Test',requestId:randomUUID()});assert.equal(x.r.status,200);const thakedaar=x.d.payroll.workers[1];
 x=await act(0,'attendance',{workerId:thakedaar.id,date:today,status:'Present',note:'',requestId:randomUUID()});assert.equal(x.r.status,400);
 x=await act(0,'attendance',{workerId:employee.id,date:today,status:'Unpaid leave',note:'Personal',requestId:randomUUID()});assert.equal(x.r.status,200);
 await act(0,'funds',{account:'Cash',amount:50000,note:'Test funds'});
 const advance={workerId:employee.id,kind:'advance',amount:5000,account:'Cash',note:'',requestId:randomUUID()};
 x=await act(0,'payroll-payment',advance);assert.equal(x.r.status,200);x=await act(0,'payroll-payment',advance);assert.equal(x.d.payroll.payments.length,1);
 x=await act(0,'salary',{workerId:employee.id,month:today.slice(0,7),bonus:0,deduction:1000,advanceApplied:5000,note:'Manual leave deduction',requestId:randomUUID()});assert.equal(x.r.status,200);const salary=x.d.payroll.salaries[0];assert.equal(salary.net,24000);
 x=await act(0,'payroll-payment',{workerId:employee.id,kind:'salary',salaryId:salary.id,amount:14000,account:'Cash',note:'Partial',requestId:randomUUID()});assert.equal(x.r.status,200);
 const reloaded=(await req(0,'/api/erp')).d;assert.equal(reloaded.payroll.payments.length,2);assert.equal(reloaded.bills.filter(b=>b.kind==='Expense').length,2);for(const k of ['stock','materials','entries','customers','assets'])assert.deepEqual(reloaded[k],initial[k]);assert.equal(reloaded.payroll.requests,undefined);
 x=await act(1,'payroll-payment',{workerId:employee.id,kind:'advance',amount:1,account:'Cash',note:'',requestId:randomUUID()});assert.equal(x.r.status,400);assert.equal((await req(1,'/api/erp')).d.payroll,undefined);
 const page=await fetch(base+'/employees',{headers:{Cookie:cookies[0]}});const html=await page.text();assert.equal(page.status,200);assert.ok(html.includes('href="/employees"')&&html.includes('Employees &amp; Thakedaar'));
 const anon=await fetch(base+'/employees',{redirect:'manual'});assert.equal(anon.status,307);assert.equal(anon.headers.get('location'),'/login');
 // Existing members do not gain payroll access; direct route and API writes remain blocked.
 await db.query("UPDATE erp_memberships SET role='staff',permissions='[\"dashboard\"]'::jsonb WHERE user_id=(SELECT id FROM erp_users WHERE email=$1)",[emails[1]]);
 x=await req(1,'/api/erp');assert.equal(x.d.payroll,undefined);x=await act(1,'worker',{...fields,requestId:randomUUID()});assert.equal(x.r.status,403);
 const denied=await fetch(base+'/employees',{headers:{Cookie:cookies[1]},redirect:'manual'});assert.equal(denied.status,307);assert.equal(denied.headers.get('location'),'/dashboard');
 console.log('PASS: authenticated route, PostgreSQL persistence, employee-only leave, advances, salary adjustment, partial payments, retry protection, single expense posting, unchanged inventory/customer data, factory isolation and restricted-member denial');
}finally{
 await db.query('DELETE FROM erp_audit WHERE user_id IN(SELECT id FROM erp_users WHERE email=ANY($1))',[emails]);
 await db.query('DELETE FROM erp_users WHERE email=ANY($1)',[emails]);
 const keys=emails.flatMap(email=>['signup','login'].map(mode=>createHash('sha256').update(email+':'+mode).digest('hex')));await db.query('DELETE FROM erp_auth_limits WHERE key=ANY($1)',[keys]);await db.end();
 console.log('Temporary payroll test accounts cleaned up');
}
