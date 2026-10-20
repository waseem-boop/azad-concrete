import env from '@next/env';import {Pool} from 'pg';import {randomBytes,createHash} from 'node:crypto';
env.loadEnvConfig(process.cwd());const base=process.env.TEST_BASE_URL||'http://localhost:3108',tag=randomBytes(6).toString('hex'),emails=[`logo-${tag}@example.test`,`logo-staff-${tag}@example.test`],password=randomBytes(18).toString('hex'),cookies=[];const uri=new URL(process.env.DATABASE_URL);uri.searchParams.delete('sslmode');const db=new Pool({connectionString:uri.toString(),ssl:{rejectUnauthorized:true,ca:process.env.AIVEN_CA_CERT.replace(/\\n/g,'\n')},max:1});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQ0AAAAASUVORK5CYII=','base64');let uploaded='';
async function req(i,path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:base,...(cookies[i]?{Cookie:cookies[i]}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {r,d:await r.json()}}
async function upload(i,bytes=png,type='image/png',origin=base){const body=new FormData();body.set('file',new Blob([bytes],{type}),'logo.png');const r=await fetch(base+'/api/uploads/logo',{method:'POST',headers:{Origin:origin,...(cookies[i]?{Cookie:cookies[i]}:{})},body});return {r,d:await r.json()}}
function check(v,label){if(!v)throw Error(label);console.log('PASS:',label)}
try{
 let x=await upload(0);check(x.r.status===401,'upload requires login');
 for(let i=0;i<2;i++){x=await req(i,'/api/auth',{mode:'signup',name:'Logo check',email:emails[i],password});check(x.r.ok,'temporary signup');cookies[i]=x.r.headers.get('set-cookie').split(';')[0]}
 x=await req(0,'/api/erp',{action:'settings',payload:{name:'Logo test factory',logo:'',address:'Factory road',phone:'0300000000',invoiceNote:'Saved note'}});check(x.r.ok,'existing factory identity fixture');
 x=await upload(0,png,'image/png','https://other.example');check(x.r.status===403,'cross-origin upload blocked');
 x=await upload(0,Buffer.from('<svg></svg>'),'image/svg+xml');check(x.r.status===400,'SVG rejected');
 x=await upload(0,Buffer.from('not an image'),'image/png');check(x.r.status===400,'fake image bytes rejected');
 x=await upload(0,Buffer.alloc(2000001),'image/png');check(x.r.status===413,'oversize logo rejected');
 x=await req(0,'/api/team',{action:'invite',email:emails[1],role:'staff',permissions:['dashboard']});check(x.r.ok,'staff invite');const token=x.d.token;
 x=await req(1,'/api/team',{action:'join',token});check(x.r.ok,'staff joins');x=await upload(1);check(x.r.status===403,'staff without settings permission cannot upload');
 x=await upload(0);if(!x.r.ok)throw Error(`Real logo upload failed: ${x.r.status} ${x.d.error}`);uploaded=x.d.logo;check(uploaded.startsWith('https://res.cloudinary.com/'),'real signed Cloudinary upload');
 const image=await fetch(uploaded);check(image.ok&&image.headers.get('content-type')?.startsWith('image/'),'uploaded logo publicly loads as image');
 x=await req(0,'/api/erp');check(x.d.settings.logo===uploaded,'logo saved immediately without separate settings save');check(x.d.settings.name==='Logo test factory'&&x.d.settings.invoiceNote==='Saved note'&&x.d.settings.address==='Factory road','logo upload preserves other factory settings');
 const state=x.d;const logoSave=await req(0,'/api/erp',{action:'settings',payload:{...state.settings,phone:'03110000000'}});check(logoSave.r.ok&&logoSave.d.settings.logo===uploaded,'later settings saves retain Cloudinary logo');
 const foreign=uploaded.replace(/\/logos\/[^/]+\//,'/logos/00000000-0000-0000-0000-000000000000/');x=await req(0,'/api/erp',{action:'settings',payload:{...state.settings,logo:foreign}});check(x.r.status===400,'another factory logo URL rejected');
 x=await req(0,'/api/erp',{action:'settings',payload:{...state.settings,logo:'https://example.com/logo.png'}});check(x.r.status===400,'arbitrary external logo URLs rejected');
 x=await req(0,'/api/erp',{action:'settings',payload:{...state.settings,logo:''}});check(x.r.ok&&x.d.settings.logo==='','remove saved logo restores initials fallback');
}finally{
 if(uploaded){const credentials=new URL(process.env.CLOUDINARY_URL),url=new URL(uploaded),publicId=decodeURIComponent(url.pathname.split('/image/upload/')[1].replace(/^v[0-9]+\//,'').replace(/\.[^.]+$/,''));const params={invalidate:'true',public_id:publicId,timestamp:String(Math.floor(Date.now()/1000))};const signature=createHash('sha1').update(Object.keys(params).sort().map(k=>`${k}=${params[k]}`).join('&')+decodeURIComponent(credentials.password)).digest('hex');const form=new FormData();for(const [k,v]of Object.entries(params))form.set(k,v);form.set('api_key',decodeURIComponent(credentials.username));form.set('signature',signature);const response=await fetch(`https://api.cloudinary.com/v1_1/${credentials.hostname}/image/destroy`,{method:'POST',body:form});const result=await response.json();if(!response.ok||!['ok','not found'].includes(result.result))throw Error('Temporary Cloudinary logo cleanup failed');console.log('Temporary Cloudinary image removed')}
 await db.query('DELETE FROM erp_audit WHERE user_id IN(SELECT id FROM erp_users WHERE email=ANY($1))',[emails]);await db.query('DELETE FROM erp_users WHERE email=ANY($1)',[emails]);await db.end();console.log('Temporary logo accounts cleaned up')
}
