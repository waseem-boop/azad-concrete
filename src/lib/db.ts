import "server-only";
import { Pool } from "pg";
let pool: Pool | undefined;
/** Server-only Aiven connection. Set both values in .env.local. */
export function getDatabase() {
  if (!process.env.DATABASE_URL || !process.env.AIVEN_CA_CERT) throw new Error("Configure DATABASE_URL and AIVEN_CA_CERT to enable Aiven PostgreSQL.");
  if (!pool) {
    const url = new URL(process.env.DATABASE_URL);
    for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(key);
    pool = new Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:true,ca:process.env.AIVEN_CA_CERT.replace(/\\n/g,"\n")},max:10});
  }
  return pool;
}
