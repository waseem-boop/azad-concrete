import "server-only";
import { Pool } from "pg";
const globalDb=globalThis as unknown as {azadPool?:Pool};
export function getDatabase(){
 if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is missing");
 if(!globalDb.azadPool){const url=new URL(process.env.DATABASE_URL);for(const key of ["sslmode","sslcert","sslkey","sslrootcert"])url.searchParams.delete(key);
 globalDb.azadPool=new Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:true,...(process.env.AIVEN_CA_CERT?{ca:process.env.AIVEN_CA_CERT.replace(/\\n/g,"\n")}: {})},max:2,idleTimeoutMillis:10000,connectionTimeoutMillis:15000});}
 return globalDb.azadPool;
}
