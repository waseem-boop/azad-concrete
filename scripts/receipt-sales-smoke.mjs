import env from '@next/env';import {Pool} from 'pg';import {randomBytes} from 'node:crypto';import assert from 'node:assert/strict';
env.loadEnvConfig(process.cwd());const base=process.env.TEST_BASE_URL||'http://localhost:3108',email=`receipt-sales-${randomBytes(6).toString('hex')}@example.test`,password=randomBytes(18).toString('hex');let cookie='';
const uri=new URL(process.env.DATABASE_URL);uri.searchParams.delete('sslmode');const db=new Pool({connectionString:uri.toString(),ssl:{rejectUnauthorized:true,ca:process.env.AIVEN_CA_CERT.replace(/\\n/g,'\n')},max:1});
async function req(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:base,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {r,d:await r.json()}}
const act=(action,payload)=>req('/api/erp',{action,payload});function check(v,label){assert.ok(v,label);console.log('PASS:',label)}const stock=(s,id)=>s.stock.find(p=>p.id===id).stock;
try{
 let x=await req('/api/auth',{mode:'signup',name:'Receipt Sales Check',email,password});check(x.r.ok,'signup');cookie=x.r.headers.get('set-cookie').split(';')[0];
 x=await act('import-products',{ids:['S0','S1','EX0','G0']});check(x.r.ok,'import selected sizes');const a=x.d.stock.find(p=>p.type==='Slab'&&p.length===3).id,b=x.d.stock.find(p=>p.type==='Slab'&&p.length===3.5).id,g=x.d.stock.find(p=>p.type==='Girder'&&p.width===6).id,incomplete=x.d.stock.find(p=>p.type==='Girder'&&!p.width).id;
 x=await act('production',{product:incomplete,quantity:1});check(x.r.status===400,'girder cross section required');
 for(const id of [a,b,g]){x=await act('production',{product:id,quantity:20});check(x.r.ok,'production without recipes or raw stock')}
 x=await act('material',{product:'Rait',quantity:2,unit:'trali',capacitySqft:150,rate:0,note:'Sand delivery'});check(x.r.ok&&x.d.materialReceipts[0].capacitySqft===150&&x.d.materialReceipts[0].quantity===2,'Rait trali count and size saved in square feet');
 x=await act('material',{product:'Rait',quantity:1,unit:'trali',rate:0});check(x.r.status===400,'trali size required');
 x=await act('material',{product:'Gitian',quantity:250,unit:'kg',rate:0});check(x.r.ok&&x.d.materials.find(m=>m.name==='Gitian').stock===250,'Gitian kg receipt');
 x=await act('material',{product:'Cement',quantity:100,unit:'kg',rate:0});check(x.r.ok&&x.d.materials.find(m=>m.name==='Cement').stock===2,'cement kg-to-bags conversion retained');
 const beforeMaterials=structuredClone(x.d.materials),beforeReceipts=structuredClone(x.d.materialReceipts);
 x=await act('production',{product:g,quantity:5});check(x.r.ok,'girder production after material receipts');assert.deepEqual(x.d.materials,beforeMaterials);assert.deepEqual(x.d.materialReceipts,beforeReceipts);check(true,'production does not alter any material quantity, value or receipt');
 const openingDate=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'});for(const batch of x.d.entries.filter(e=>e.product.startsWith('Slab'))){const opened=await act('production-opening',{batchId:batch.id,date:openingDate,good:batch.quantity,damaged:0});check(opened.r.ok,'confirm slab opening before sales')}
 x=await act('customer',{name:'Test Dealer',phone:'',kind:'dealer'});check(x.r.ok,'dealer saved with optional phone');const dealer=x.d.customers[0].id;
 x=await act('gatepass',{customerType:'dealer',customerId:dealer,items:[{product:a,quantity:3,rate:500},{product:b,quantity:2,rate:700}],discount:200});const invoice=x.d.bills[0];check(x.r.ok&&invoice.items.length===2&&invoice.subtotal===2900&&invoice.amount===2700&&stock(x.d,a)===17&&stock(x.d,b)===18,'multi-product sale, per-item price, dealer discount and stock deduction');check(x.d.journals.find(j=>j.reference===invoice.id).lines.find(l=>l.account==='Accounts receivable').debit===2700,'receivable uses discounted amount');
 x=await act('gatepass',{customerType:'walk-in',name:'Walk In Sale',items:[{product:a,quantity:1,rate:600},{product:g,quantity:1,rate:2000}],discount:0});check(x.r.ok,'walk-in sale without phone');const walk=x.d.bills[0],walkId=walk.customerId;
 check(walk.name==='Walk In Sale'&&walk.phone===''&&walk.customerType==='walk-in'&&walk.items[1].rate===2000&&walk.items[1].quantity===1,'walk-in name and purchased product details saved');check(x.d.customers.find(c=>c.id===walkId)?.kind==='walk-in','walk-in customer saved in customer register');
 x=await act('gatepass',{customerType:'walk-in',customerId:walkId,items:[{product:a,quantity:1,rate:600}]});check(x.r.ok&&x.d.bills[0].customerId===walkId,'repeat sale for saved walk-in customer');
 const failures=[
  [{customerType:'walk-in',name:'No Discount',items:[{product:a,quantity:1,rate:600}],discount:1},'walk-in discount blocked by server'],
  [{customerType:'walk-in',name:'',items:[{product:a,quantity:1,rate:600}]},'walk-in name required'],
  [{customerType:'dealer',customerId:walkId,items:[{product:a,quantity:1,rate:600}]},'walk-in cannot be used as dealer'],
  [{customerType:'dealer',customerId:dealer,items:[{product:a,quantity:1,rate:600}],discount:601},'excess discount rejected'],
  [{customerId:dealer,items:[{product:a,quantity:1,rate:-1}]},'invalid price rejected'],
  [{customerId:dealer,items:[{product:a,quantity:9,rate:600},{product:a,quantity:9,rate:600}]},'duplicate product rows cannot oversell'],
  [{customerType:'walk-in',name:'Should Roll Back',items:[{product:a,quantity:1,rate:600},{product:b,quantity:99,rate:700}]},'second-row failure rolls back entire sale']
 ];for(const [p,label] of failures){x=await act('gatepass',p);check(x.r.status===400,label)}
 x=await req('/api/erp');check(stock(x.d,a)===15&&stock(x.d,b)===18&&!x.d.customers.some(c=>c.name==='Should Roll Back'),'failed invoices preserve stocks and customer register');assert.deepEqual(x.d.materials,beforeMaterials);check(true,'dispatches never affect raw material receipts');
 const concurrent=await Promise.all([act('gatepass',{customerId:dealer,items:[{product:b,quantity:12,rate:1000}]}),act('gatepass',{customerId:dealer,items:[{product:b,quantity:12,rate:1000}]})]);check(concurrent.filter(x=>x.r.ok).length===1,'concurrent gatepasses cannot oversell');
 // Alter only this disposable factory to represent an existing cft balance.
 const {rows}=await db.query('SELECT w.state,w.user_id FROM erp_workspaces w JOIN erp_users u ON u.id=w.user_id WHERE u.email=$1',[email]);const old=rows[0].state,m=old.materials.find(m=>m.name==='Gitian');m.stock=55;m.unit='cft';delete m.quantities;await db.query('UPDATE erp_workspaces SET state=$2 WHERE user_id=$1',[rows[0].user_id,JSON.stringify(old)]);
 x=await act('material',{product:'Gitian',quantity:25,unit:'kg',rate:0});const mixed=x.d.materials.find(m=>m.name==='Gitian');check(x.r.ok&&mixed.unit==='cft'&&mixed.stock===55&&mixed.quantities.kg===25,'historical cft totals preserved separately from kg');
 x=await req('/api/erp');check(x.d.materialReceipts.some(m=>m.unit==='trali'&&m.capacitySqft===150)&&x.d.bills.some(b=>b.id===walk.id&&b.items.length===2),'trali details and walk-in purchases survive reload');check(x.d.journals.every(j=>Math.round(j.lines.reduce((a,l)=>a+l.debit-l.credit,0)*100)===0),'all journals balance');
}finally{await db.query('DELETE FROM erp_audit WHERE user_id IN(SELECT id FROM erp_users WHERE email=$1)',[email]);await db.query('DELETE FROM erp_users WHERE email=$1',[email]);await db.end();console.log('Temporary receipt/sales account cleaned up')}
