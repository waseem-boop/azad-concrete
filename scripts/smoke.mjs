import env from '@next/env';
import {Pool} from 'pg';
import {randomBytes} from 'node:crypto';
env.loadEnvConfig(process.cwd());
const base='http://localhost:3101';
const email=`erp-check-${randomBytes(6).toString('hex')}@example.test`;
const password=randomBytes(18).toString('hex');
let cookie='';
async function request(path,method='GET',body){const res=await fetch(base+path,{method,headers:{Origin:base,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await res.json();return {res,data}}
function check(ok,label){if(!ok)throw new Error(label);console.log('PASS:',label)}
const uri=new URL(process.env.DATABASE_URL);for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])uri.searchParams.delete(key);
const db=new Pool({connectionString:uri.toString(),ssl:{rejectUnauthorized:true,ca:process.env.AIVEN_CA_CERT.replace(/\\n/g,'\n')},max:1});
try{
 let r=await request('/api/erp');check(r.res.status===401,'unauthenticated access denied');
 r=await request('/api/auth','POST',{mode:'signup',name:'Integration Check',email,password});check(r.res.ok,'signup');cookie=r.res.headers.get('set-cookie').split(';')[0];
 r=await request('/api/erp');check(r.res.ok&&r.data.stock.every(p=>p.stock===0),'private empty workspace');
 const id=r.data.stock[0].id;
 const act=async(action,payload)=>request('/api/erp','POST',{action,payload});
 for(const product of ['Saria','Gitian','Cement','Bajri','Rait']){r=await act('material',{product,quantity:100});check(r.res.ok,`${product} receipt`)}
 r=await act('size',{id,type:'Slab',length:3,width:1,recipe:[1,1,1,1,1]});check(r.res.ok,'save per-piece recipe');
 r=await act('production',{product:id,quantity:10});check(r.res.ok&&r.data.stock[0].stock===10&&r.data.materials.every(m=>m.stock===90),'production adds stock and deducts materials');
 r=await act('production',{product:id,quantity:1000});check(r.res.status===400,'insufficient material blocked');
 r=await act('gatepass',{product:id,quantity:3,rate:500,name:'Test customer'});check(r.res.ok&&r.data.stock[0].stock===7&&r.data.bills[0].amount===1500,'gatepass deducts stock and totals invoice');
 r=await act('payment',{quantity:1,rate:1000,name:'Test customer'});check(r.res.ok&&r.data.bills[0].kind==='Payment','customer payment');
 r=await act('expense',{quantity:1,rate:200,name:'Electricity'});check(r.res.ok&&r.data.bills[0].amount===200,'expense');
 r=await act('size',{type:'Girder',length:16,width:6,height:9,recipe:[2,2,2,2,2]});check(r.res.ok&&r.data.stock.some(p=>p.size==='6″ × 9″ × 16′'),'three-dimension custom girder');
 r=await act('gatepass',{product:id,quantity:99,rate:500,name:'Test customer'});check(r.res.status===400,'overselling blocked');
 r=await request('/api/erp');check(r.data.stock[0].stock===7&&r.data.materials.every(m=>m.stock===90),'failed writes rolled back');
 r=await request('/api/auth','DELETE');check(r.res.ok,'sign out');
 r=await request('/api/erp');check(r.res.status===401,'revoked session rejected');cookie='';
 r=await request('/api/auth','POST',{mode:'login',email,password});check(r.res.ok,'password login');
 check((await fetch(base+'/api/auth',{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:'{}'})).status===403,'cross-origin write rejected');
}finally{await db.query('DELETE FROM erp_audit WHERE user_id IN(SELECT id FROM erp_users WHERE email=$1)',[email]);await db.query('DELETE FROM erp_users WHERE email=$1',[email]);await db.query('DELETE FROM erp_auth_limits WHERE key IN (SELECT encode(sha256(convert_to($1,\'UTF8\')),\'hex\') UNION SELECT encode(sha256(convert_to($2,\'UTF8\')),\'hex\'))',[email+':login',email+':signup']);await db.end();console.log('Temporary integration account cleaned up.')}
