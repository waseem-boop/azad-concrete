import env from '@next/env';
const {loadEnvConfig}=env;
import {Pool} from 'pg';
import {readFileSync} from 'node:fs';
loadEnvConfig(process.cwd());
const uri=new URL(process.env.DATABASE_URL);
for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])uri.searchParams.delete(key);
const pool=new Pool({connectionString:uri.toString(),ssl:{rejectUnauthorized:true,...(process.env.AIVEN_CA_CERT?{ca:process.env.AIVEN_CA_CERT.replace(/\\n/g,'\n')}:{})},max:1,connectionTimeoutMillis:15000});
try{await pool.query(readFileSync('database/003_live_erp.sql','utf8'));console.log('Aiven connected. ERP database tables ready.');}catch(e){console.error('Database setup failed:',e.code||e.message);process.exitCode=1}finally{await pool.end()}
