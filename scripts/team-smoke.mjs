import env from '@next/env';import {Pool} from 'pg';import {randomBytes} from 'node:crypto';env.loadEnvConfig(process.cwd());const u=new URL(process.env.DATABASE_URL);u.searchParams.delete('sslmode');const db=new Pool({connectionString:u.toString(),ssl:{rejectUnauthorized:true,ca:process.env.AIVEN_CA_CERT.replace(/\\n/g,'\n')},max:1});const base=process.env.TEST_BASE_URL||'http://localhost:3108',tag=randomBytes(5).toString('hex'),emails=[`owner-${tag}@example.test`,`staff-${tag}@example.test`,`other-${tag}@example.test`],password=randomBytes(18).toString('hex');const cookies=[];
async function req(i,path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:base,...(cookies[i]?{Cookie:cookies[i]}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {r,d:await r.json()}}
function ok(v,label){if(!v)throw new Error(label);console.log('PASS:',label)}
try{for(let i=0;i<3;i++){const {r}=await req(i,'/api/auth',{mode:'signup',name:'Team check',email:emails[i],password});ok(r.ok,'temporary signup');cookies[i]=r.headers.get('set-cookie').split(';')[0]}
let {d,r}=await req(0,'/api/team',{action:'invite',email:emails[1],role:'staff',permissions:['materials_manage']});ok(r.ok,'owner invitation');const token=d.token;
({r}=await req(2,'/api/team',{action:'join',token}));ok(r.status===400,'invite bound to email');
({r}=await req(1,'/api/team',{action:'join',token}));ok(r.ok,'staff joins shared factory');
({r}=await req(1,'/api/erp',{action:'material',payload:{product:'Saria',quantity:25}}));ok(r.ok,'staff receipt');
({d}=await req(0,'/api/erp'));ok(d.materials[0].stock===25,'owner sees staff changes');
({d}=await req(2,'/api/erp'));ok(d.materials[0].stock===0,'unrelated workspace isolated');
({r}=await req(1,'/api/team',{action:'invite',email:emails[2]}));ok(r.status===403,'staff cannot invite');
({r}=await req(1,'/api/erp',{action:'journal',payload:{description:'Unauthorized',lines:[{account:'Cash / Bank',debit:1,credit:0},{account:'Capital',debit:0,credit:1}]}}));ok(r.status===403,'staff cannot post manual journal');
({r}=await req(1,'/api/erp',{action:'settings',payload:{name:'Not allowed',logo:'',address:'',phone:'',invoiceNote:''}}));ok(r.status===403,'staff cannot change factory identity');
({r}=await req(0,'/api/team',{action:'remove',email:emails[1]}));ok(r.ok,'owner removes staff access');
({d}=await req(1,'/api/erp'));ok(d.materials[0].stock===0,'removed staff no longer sees factory records');
}finally{await db.query('DELETE FROM erp_audit WHERE user_id IN(SELECT id FROM erp_users WHERE email=ANY($1))',[emails]);await db.query('DELETE FROM erp_users WHERE email=ANY($1)',[emails]);await db.end();console.log('Temporary team accounts cleaned up')}
