# Azad Concrete ERP

Next.js App Router + TypeScript. Run `npm install`, then `npm run dev` and open http://localhost:3000.

## Implemented prototype
Responsive dashboard, all 13 slab sizes and 25 girder sizes (10–22 ft, half-foot increments), searchable inventory and CSV export. Production adds finished goods and deducts sample raw-material consumption. Material receipts, gatepass dispatches and expenses are saved in browser localStorage. Insufficient material or finished stock is blocked. Data is illustrative, per browser, and is not a production accounting system.

The production chart is explicitly illustrative. Recipe constants are sample estimates in src/app/page.tsx; actual factory recipes must be confirmed. Accounts shows invoice and expense totals only. Authentication, payment ledger, printable invoices, recipe editing and server persistence remain to be implemented.

## Aiven PostgreSQL foundation
Copy .env.example to .env.local and provide an Aiven PostgreSQL connection URI and its project CA certificate. src/lib/db.ts provides a server-only pool with certificate verification. database/schema.sql contains the initial relational schema. Neither the database nor schema has been connected or applied. UI intentionally stays in local demo mode until authenticated transactional server workflows are added.

Before live use, production must run as one database transaction with row locks, sufficient-stock validation, recipe consumption snapshots and an audit trail. Gatepass stock deduction also needs a transaction. Add authentication and authorization before exposing write endpoints.

## Checks
npm run lint
npm run build
