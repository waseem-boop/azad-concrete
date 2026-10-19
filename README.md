# Azad Concrete ERP

Next.js, TypeScript and Aiven PostgreSQL. The app root is `azad-concrete/`.

## Local setup
1. Install packages: `npm ci`.
2. Set `DATABASE_URL` and `AIVEN_CA_CERT` in `.env.local` (already configured locally). The CA value can contain literal escaped newlines (`\n`).
3. Wait for the Aiven PostgreSQL service to show Running, then run `npm run db:setup`.
4. Run `npm run dev`, open http://localhost:3000/signup and create your account.

Every account gets a separate private workspace with zero quantities. Browser demo records are not imported into the database. Register once for your factory and reuse that login; team invitations and shared memberships are not implemented.

## Workflow
- Dashboard: summaries, actual production chart and read-only slab stock overview.
- Stocks: custom slab sizes (feet), girder width/height (inches) and length (feet), per-piece material recipes, search and export.
- Raw Material: add Saria, Gitian, Cement, Bajri and Rait receipts.
- Production: requires a saved recipe and enough materials. Saves finished stock, deductions and batch atomically.
- Gatepass: dispatch finished stock, record invoice amounts and print a gatepass.
- Accounts: invoice totals, recorded customer payments, aggregate outstanding balance and expenses. This is an operational register, not a full double-entry accounting ledger.
- Expenses: record descriptions and amounts.

Authenticated write routes validate inputs, lock the workspace row and save in a PostgreSQL transaction. The per-account workspace is stored as JSONB and write actions are audited. Passwords use salted scrypt hashes; sessions use random tokens stored as hashes, with HttpOnly/SameSite cookies and a seven-day lifetime. Login attempts have a database-backed limit. There is no email verification or password-reset service yet.

## Vercel deployment
Set **Root Directory** to `azad-concrete` if importing the parent directory; if the repository starts inside this folder, leave Root Directory at its default. The project includes `vercel.json`.

In Vercel → Project Settings → Environment Variables, add:
- `DATABASE_URL`: copy the value from your local `.env.local`.
- `AIVEN_CA_CERT`: paste the entire PEM certificate (actual newlines or escaped newlines both work).

Add these to Production and any Preview environment you use, then deploy. Local `.env.local` is ignored by Git and is not uploaded by a repository deployment. Run `npm run db:setup` once against the intended database before signup. Builds deliberately do not require a running database, and do not run migrations automatically.

Checks: `npm run lint` and `npm run build`.
