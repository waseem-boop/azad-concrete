import env from '@next/env';import {Pool} from 'pg';import {randomBytes} from 'node:crypto';
env.loadEnvConfig(process.cwd());const uri=new URL(process.env.DATABASE_URL);uri.searchParams.delete('sslmode');const db=new Pool({connectionString:uri.toString(),ssl:{rejectUnauthorized:true,ca:process.env.AIVEN_CA_CERT.replace(/\\n/g,'\n')},max:1});
const base=process.env.TEST_BASE_URL||'http://localhost:3111',tag=randomBytes(5).toString('hex'),emails=['owner','member','outsider'].map(x=>`${x}-rbac-${tag}@example.test`),password=randomBytes(18).toString('hex'),cookies=[];
async function req(i,path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:base,...(cookies[i]?{Cookie:cookies[i]}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {r,d:await r.json()}}
const act=(i,action,payload={})=>req(i,'/api/erp',{action,payload});function check(v,label){if(!v)throw new Error(label);console.log('PASS:',label)}
const update=(role,permissions)=>req(0,'/api/team',{action:'update',email:emails[1],role,...(permissions?{permissions}:{})});
try{
 for(let i=0;i<3;i++){const {r}=await req(i,'/api/auth',{mode:'signup',name:`RBAC ${i}`,email:emails[i],password});check(r.ok,'temporary signup');cookies[i]=r.headers.get('set-cookie').split(';')[0]}
 let x=await act(0,'opening',{account:'Cash',amount:100000});check(x.r.ok,'owner funding');
 x=await act(0,'import-products',{ids:['S0']});check(x.r.ok,'owner product fixture');let product=x.d.stock[0];
 x=await act(0,'size',{id:product.id,type:'Slab',length:product.length,width:product.width,recipe:[1,1,.1,1,1],confirmed:true,salePrice:1000});check(x.r.ok,'owner product dimensions and price');
 for(const name of ['Saria','Gitian','Cement','Bajri','Rait']){x=await act(0,'material',{product:name,quantity:100,capacitySqft:150,rate:1,account:'Cash'});check(x.r.ok,`fixture ${name}`)}
 x=await act(0,'customer',{name:'RBAC customer',phone:'0300'});check(x.r.ok,'fixture customer');const customerId=x.d.customers[0].id;
 x=await req(0,'/api/team',{action:'invite',email:emails[1],role:'owner',permissions:[]});check(x.r.status===400,'cannot invite another owner');
 x=await req(0,'/api/team',{action:'invite',email:emails[1],role:'staff',permissions:['fake_feature']});check(x.r.status===400,'unknown permission rejected');
 x=await req(0,'/api/team',{action:'invite',email:emails[1],role:'staff'});check(x.r.ok,'staff preset invitation');const oldToken=x.d.token;
 x=await req(0,'/api/team',{action:'invite',email:emails[1],role:'staff'});const token=x.d.token;check(x.r.ok,'replacement invite created');
 x=await req(1,'/api/team',{action:'join',token:oldToken});check(x.r.status===400,'old invitation invalidated');
 x=await req(2,'/api/team',{action:'join',token});check(x.r.status===400,'invitation email bound');
 x=await req(1,'/api/team',{action:'join',token});check(x.r.ok,'member joins staff preset');
 x=await req(1,'/api/erp');check(x.d.access.role==='staff'&&x.d.access.permissions.includes('production'),'invited role/access preserved');check(x.d.journals.length===0&&x.d.bills.length===0&&x.d.customers.length===0&&x.d.assets.length===0,'staff financial datasets hidden');check(x.d.materials.every(m=>!('inventoryValue' in m)&&!('purchaseRate' in m))&&x.d.stock.every(p=>!('inventoryValue' in p)),'staff book values hidden');
 x=await act(1,'production',{product:product.id,quantity:10});check(x.r.ok&&x.d.entries[0].quantity===10&&!('materialCost' in x.d.entries[0])&&x.d.journals.length===0,'staff production works and response hides finance');
 for(const action of ['size','import-products','material','gatepass','customer','payment','funds','opening','transfer','journal','expense','asset','settings','material-settings']){x=await act(1,action);check(x.r.status===403,`staff blocked: ${action}`)}
 x=await req(1,'/api/templates');check(x.r.status===403,'templates protected');
 x=await req(1,'/api/team');check(x.d.members.length===1&&x.d.members[0].email===emails[1],'staff can only see own access');
 x=await req(1,'/api/team',{action:'update',email:emails[1],role:'manager',permissions:['settings_manage']});check(x.r.status===403,'member cannot escalate own access');
 const blocked=await fetch(base+'/accounts',{headers:{Cookie:cookies[1]},redirect:'manual'});check(blocked.status===307&&blocked.headers.get('location')==='/dashboard','direct restricted route blocked');
 const staffHtml=await (await fetch(base+'/stocks',{headers:{Cookie:cookies[1]}})).text();check(!staffHtml.includes('href="/accounts"')&&!staffHtml.includes('Import sizes')&&!staffHtml.includes('Add size'),'restricted navigation and product controls hidden');
 x=await update('cashier');check(x.r.ok,'owner changes member to cashier');
 x=await req(1,'/api/erp');check(x.d.access.role==='cashier'&&x.d.journals.length>0&&x.d.materials.length===0&&x.d.entries.length===0,'new role takes effect without new login');
 x=await act(1,'gatepass',{product:product.id,customerId,quantity:2,rate:1000});check(x.r.ok&&x.d.bills[0].kind==='Gatepass','cashier invoice dispatch works');
 x=await act(1,'payment',{customerId,quantity:1,rate:1000,account:'Bank'});check(x.r.ok,'cashier receipt works');
 x=await act(1,'expense',{name:'RBAC expense',quantity:1,rate:100,account:'Cash'});check(x.r.ok,'cashier expense works');
 x=await act(1,'production',{product:product.id,quantity:1});check(x.r.status===403,'cashier production blocked');
 x=await act(1,'transfer',{from:'Cash',to:'Bank',amount:1});check(x.r.status===403,'cashier fund transfers blocked');
 x=await update('cashier',['gatepass_manage']);check(x.r.ok,'custom invoice-only access saved');
 x=await req(1,'/api/erp');check(x.d.access.permissions.includes('stocks_view')&&x.d.access.permissions.includes('gatepass_view')&&!x.d.access.permissions.includes('accounts_view'),'required views automatically included');check(x.d.journals.length===0&&x.d.bills.every(b=>b.kind==='Gatepass')&&x.d.customers.length===1,'invoice-only member sees required data without finance');
 x=await act(1,'gatepass',{product:product.id,customerId,quantity:1,rate:1000});check(x.r.ok&&x.d.journals.length===0,'custom invoice-only dispatch works without finance leak');
 const denied=await fetch(base+'/dashboard',{headers:{Cookie:cookies[1]},redirect:'manual'});check(denied.status===307&&denied.headers.get('location')==='/stocks','landing redirects to first allowed page');
 x=await update('manager',['settings_manage','assets_manage','funds_manage','journals_manage']);check(x.r.ok,'custom manager rights saved');
 x=await act(1,'settings',{name:'RBAC factory',logo:'',address:'',phone:'',invoiceNote:''});check(x.r.ok,'delegated settings works');
 x=await act(1,'asset',{name:'RBAC trolley',quantity:1,purchaseDate:'2026-10-20',purchaseValue:500,currentValue:500,condition:'Working',source:'existing'});check(x.r.ok,'delegated asset management works');
 x=await act(1,'transfer',{from:'Cash',to:'Bank',amount:1});check(x.r.ok,'delegated transfers work');
 x=await act(1,'journal',{description:'RBAC capital',lines:[{account:'Cash',debit:1,credit:0},{account:'Capital',debit:0,credit:1}]});check(x.r.ok,'delegated journals work');
 x=await req(0,'/api/team',{action:'update',email:emails[0],role:'staff',permissions:[]});check(x.r.status===400,'owner access protected');
 x=await req(2,'/api/team',{action:'update',email:emails[1],role:'manager',permissions:[]});check(x.r.status===400,'other factory owner cannot edit member');
 x=await update('staff',[]);check(x.r.ok,'all business permissions revoked');
 x=await req(1,'/api/erp');check(x.d.stock.length===0&&x.d.materials.length===0&&x.d.journals.length===0,'revoked member sees no business data');
 const noAccess=await fetch(base+'/dashboard',{headers:{Cookie:cookies[1]},redirect:'manual'});check(noAccess.status===307&&noAccess.headers.get('location')==='/team','member with no access lands on own access page');
 x=await act(1,'production',{product:product.id,quantity:1});check(x.r.status===403,'revoked active session blocked');
 x=await req(0,'/api/team',{action:'remove',email:emails[1]});check(x.r.ok,'owner removes non-owner member');
 x=await req(1,'/api/team',{action:'join',token});check(x.r.status===400,'removed member cannot reuse consumed invite');
 x=await req(1,'/api/erp');check(x.d.access.role==='owner'&&x.d.stock.length===0,'removed member only sees own empty factory');
}finally{await db.query('DELETE FROM erp_audit WHERE user_id IN(SELECT id FROM erp_users WHERE email=ANY($1))',[emails]);await db.query('DELETE FROM erp_users WHERE email=ANY($1)',[emails]);await db.end();console.log('Temporary permission accounts cleaned up')}
