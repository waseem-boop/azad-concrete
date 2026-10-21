# Azad Concrete ERP

Next.js, TypeScript and Aiven PostgreSQL. The app root is `azad-concrete/`.

## Local setup
1. Install packages: `npm ci`.
2. Set `DATABASE_URL`, `AIVEN_CA_CERT` and `CLOUDINARY_URL` in `.env.local` (already configured locally). The CA value can contain literal escaped newlines (`\n`).
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
- `CLOUDINARY_URL`: copy the server-only Cloudinary connection value from `.env.local` for factory logo uploads.

Add these to Production and any Preview environment you use, then deploy. Local `.env.local` is ignored by Git and is not uploaded by a repository deployment. Run `npm run db:setup` once against the intended database before signup. Builds deliberately do not require a running database, and do not run migrations automatically.

Checks: `npm run lint` and `npm run build`.
## Shared factory and accounting update
- Dashboard shows lifetime slab production per size separately from inventory and girder stock per complete size. New batches retain product IDs; older batches use their saved label for matching.
- Configure real dimensions and per-piece recipes in Stocks and tick factory confirmation. Production requires this confirmation. A size with production history cannot have its dimensions changed; create a new variant instead. Actual consumption values must be supplied by the factory.
- Accounts includes a customer register, customer running ledger and CSV export, general ledger, automatic balanced postings for invoices/payments/expenses, permission-controlled manual journals, trial balance, profit/loss and balance sheet. Opening capital, purchases, inventory values and COGS require monetary journal entries; stock quantities are not automatically valued. Receivables use customer invoices/payments rather than manual journals. Tax filing, payroll, bank reconciliation, supplier subledgers and automated inventory costing are outside this implementation.
- Factory team (sidebar): owner generates an email-bound 48-hour invite code and shares it manually. Staff signs up with that email and joins using the code from Factory team. Joining requires a fresh account with no business transactions; no data is silently merged or deleted. Owner can remove staff access. Members can operate only the features granted by the owner and cannot manage team membership. No invitation emails are sent automatically.
- `npm run db:setup` applies membership migration and backfills historical customer/journal references while preserving quantities. It has been applied to the configured Aiven database. Re-running it is idempotent.
- Integration scripts: `scripts/smoke.mjs` and `scripts/team-smoke.mjs` use a local production server on port 3102 and create/delete temporary accounts. They exercise production, financial balancing, shared access and revocation.
## Units, pricing, cash/bank and assets
Material base units remain compatible with existing data: Saria kg, Cement 50-kg bags, Gitian/Bajri/Rait cubic feet (cft). Receipt forms support Saria tonnes (1,000 kg) and Cement kg (50 kg per bag). Product recipe inputs offer the same unit choices and convert to base quantities before saving. Aggregates never assume a mass/volume density conversion.

Product configuration stores sale price per piece. Gatepasses prefill that price and permit an explicit override. Inventory cards show estimated material cost and material-only margin; missing material rates are marked incomplete. This is not a full labor/overhead costing model.

Material receipts can carry purchase rates per chosen receipt unit and be paid from Cash, Bank or Accounts payable. Stock quantities and book values update atomically. Production transfers material book costs into finished goods, and dispatch transfers proportional finished-goods cost into cost of goods sold. Zero-rate opening material receipts preserve quantity but have zero book cost and will understate profit costs; enter actual purchase rates for meaningful costing. Existing quantities and historical records are not revalued automatically.

Accounts provides separate Cash/Bank openings and transfers, explicit funding choices for payments/expenses and insufficient-balance validation. Opening balances are accepted once per account. Old combined Cash / Bank journals stay intact as unallocated legacy funds; use Transfer funds to allocate them, without creating sales revenue.

Assets page stores equipment name, quantity, purchase date/value, total current value, condition and notes. Opening already-owned equipment posts Equipment/Capital without reducing cash. Paid equipment purchases reduce the selected Cash/Bank account; initial book value equals purchase cost. Subsequent valuation changes post against Asset revaluation. Values are totals for the listed quantity, not per-unit prices. Asset management requires the Manage assets permission. Dashboard total book assets sums ledger account balances once, without adding asset-register values again. No automatic depreciation or tax valuation is implied.

The glass UI is shared across all ERP pages, forms and tables and is isolated from the authentication CSS modules. No new deployment environment variables or relational schema migration is needed for these JSONB state extensions. Verification scripts now include `scripts/finance-smoke.mjs` (set TEST_BASE_URL to your local server).

## Empty signup catalog, settings and page URLs
New signups start with no products. Existing factories keep all their sizes and quantities. Stocks → Import sizes loads server-owned templates from `erp_product_templates`; users select slabs/girders and import only missing dimension variants with zero stock/price and no factory-confirmed recipe. Custom Add size remains available. `npm run db:setup` creates and seeds the optional template catalog idempotently; it has already been applied to the configured Aiven database.

Settings (`/settings`) lets owners and members granted Factory settings permission change factory name, PNG/JPG/WebP logo (up to 2 MB), phone, address, invoice note, material descriptions and storage capacities. Branding applies to sidebar and invoice printouts. Material base units remain fixed to avoid corrupting recipes and existing quantities. Sizes, recipes and sale prices remain editable in Stocks. Cash/bank values use their accounting workflows rather than arbitrary settings edits.

Routes: `/dashboard`, `/stocks`, `/raw-material`, `/gatepass`, `/accounts`, `/expenses`, `/assets`, `/settings`. `/` redirects to `/dashboard`; direct routes require login. Navigation uses browser history so refresh/back/forward resolve the corresponding page. No new environment variables are needed.

Light mode working text is black. Both theme dropdowns keep compact layouts with a restrained translucent surface. `scripts/settings-smoke.mjs` tests signup/import/settings/direct routes using a temporary account and a local production server on port 3109. Existing tests explicitly import their fixtures after signup.
Factory Team now has its own authenticated `/team` route. It no longer mounts above Dashboard. All sidebar page entries are native Next.js links, including Team; right-click/open in new tab, middle-click, Ctrl/Cmd-click and copy-link work through normal browser behavior. Route tests also verify the actual rendered href values and that `/team` contains team content without dashboard widgets.

## Team roles and feature permissions
Factory Team (`/team`) lets the owner choose Staff, Cashier or Manager when creating an email-bound invite. Presets can be customised using feature checkboxes. Owners can edit a joined member's role/access or remove them; members cannot manage other members or change owner access. Creating a replacement invite invalidates the previous unused code for that factory/email. Joined and removed members cannot reuse their old codes.

View and write permissions are separate for stock, raw materials, invoices, accounts, expenses and assets. Additional permissions cover production, cash/bank openings and transfers, manual journals and settings. Selecting an action includes the view permissions it requires. Dashboard is an operational overview; its financial panel requires View accounts. Accounts permission includes the financial ledger and all financial register records. Team members only see their own role/access on the Team page. Shared team management remains owner-only.

Permissions are checked on direct page requests, template requests and every ERP mutation. API responses omit disallowed datasets and financial book values. Changes apply to subsequent requests, including already signed-in sessions; refresh updates the member's navigation. Existing staff retain their former feature access until the owner edits it. New Staff presets are restricted to operational views and production. Apply `npm run db:setup` on another database to install `006_permissions.sql`; the configured Aiven database is already migrated. No new environment variables required.

`scripts/permissions-smoke.mjs` verifies role presets, customised invite permissions, member updates, protected routes and actions, response redaction, role changes on active sessions, invitation replacement/reuse, owner protection and cross-factory isolation using disposable accounts.

Accounts separates **Add funds** (owner capital paid into Cash or Bank, without a customer) from **Receive customer payment** (customer receipt reducing receivables). Add funds can be used repeatedly after initial opening balances and requires the funds permission. Customer receipts and expenses use a single Amount field; quantity and rate remain on product invoices and material receipts. Existing payment/expense API payloads remain compatible.

## Accounts and Customers pages
Accounts (`/accounts`) defaults to Cash/Bank balances and Payment history. Funds actions and transfers use compact dialogs. History derives from the existing saved journals, including earlier funds additions, raw material purchases, expenses, asset purchases, customer receipts and manual cash/bank adjustments. Cash/Bank filters, movement/date/search filters, CSV export, transaction details and running balances are available. Running balances are calculated over all earlier movements before display filters. Cash-to-bank transfers appear once in combined history, showing both sides with no change in combined balance. The Older Cash / Bank filter preserves access to legacy combined-account records; those funds stay excluded from available Cash/Bank until allocated. Financial reports live in a separate tab.

Customers (`/customers`) holds add/edit, searchable customer list, per-customer invoices/receipts and running ledger, CSV export, invoice printing and customer-prefilled receipt/invoice actions. Each customer's ledger has a native `/customers?customer=<id>` link. Editing names/phones preserves customer IDs and all historical transactions. The existing Accounts view and Customers & receipts permissions control this page and its writes. No new database migration or environment variables are needed.

Validation: `node scripts/payment-history-smoke.mjs` tests history calculations and the populated Accounts rendering. `node scripts/accounts-smoke.mjs` tests a disposable factory's funds, Rs. 20,000 deduction, transfers, customer edits/receipts, persisted history and direct routes. Set TEST_BASE_URL for the local server.

## Cloudinary factory logos and Settings tabs
Settings now has Factory details, Invoice settings and Materials & alerts tabs. The Materials tab shows one material at a time using individual Saria/Gitian/Cement/Bajri/Rait tabs. Draft inputs remain when switching tabs. Saving factory or invoice settings preserves the other saved section.

`CLOUDINARY_URL` is server-only and must also be set in Vercel Production/Preview followed by redeployment. Settings uploads PNG/JPG/WebP logos up to 2 MB through an authenticated, same-origin `/api/uploads/logo` route with Factory settings permission. The server signs Cloudinary uploads, limits the stored image to 512 × 512, and saves its HTTPS URL in the factory's existing JSONB settings. Credentials never enter client code. Upload immediately updates the sidebar logo and persists it for reloads and invoice printing; other factory fields are preserved. Existing inline logos remain compatible. Remove logo takes effect when Save factory details is clicked. Removed/replaced image files are retained in Cloudinary; only the factory's active logo reference changes.

`scripts/logo-smoke.mjs` exercises a real signed upload and image delivery, immediate persistence, future settings saves, permission/origin/type/size checks and workspace URL isolation. It uses disposable accounts and removes the temporary Cloudinary image afterward.

Factory branding now uses a per-factory/per-user browser cache. Only name/logo metadata are stored in localStorage; logo image blobs use Cache Storage. Sidebar and Settings previews resolve local blobs first and share in-flight downloads. Newly uploaded files are cached immediately, so there is no additional Cloudinary download on the uploading browser. Reload reads saved branding before the ERP response, then reconciles with current server settings. A changed logo URL replaces the local entry. On another browser, or when browser storage is cleared/unavailable, the image downloads once and ordinary browser caching remains the fallback. No financial records or credentials are stored by this cache. `node scripts/branding-cache-smoke.mjs` verifies local reload with no network, upload priming, replacement, request deduplication, scope isolation and unavailable-storage fallback.

## Local data cache and targeted loading states
Loading placeholders appear only on database-backed values, chart bars, images and record rows. Navigation, page/section headings, labels, tabs, filters and action buttons remain visible. No whole-page skeleton replaces the interface.

The redacted ERP state is cached in browser Cache Storage, with an in-memory fallback. Keys include factory, user, role and the exact permission set; business data is cleared on sign-out and snapshots expire after 24 hours. Cached results display immediately with an Updating indicator while the server is checked. Writes are disabled until the initial check succeeds. If refresh fails, a visible saved-data message and Retry remain, and writes are disabled.

Every load/navigation, window focus, return online, visible-tab activation and 30-second visible-page interval revalidates against PostgreSQL. ETags cover the workspace identity, content hash, updated timestamp and permission set. Unchanged data returns 304 without re-downloading the state; changed data or permissions returns a new version. Saves replace cached state immediately, abort earlier reads and notify other open tabs. Logo uploads patch the cached settings then revalidate. Direct database updates are detected through the content hash even if updated_at was not changed. Cached data can briefly show its last saved version while the Updating indicator is visible; server data wins after verification.

Checks: `node scripts/workspace-cache-smoke.mjs`, `node scripts/freshness-smoke.mjs`, `node scripts/branding-cache-smoke.mjs` and `node scripts/payment-history-smoke.mjs` cover persistent cache scope/order/expiry, server invalidation, logo caching and loading renders that preserve static UI.


## Slab production openings
Stocks now has per-size Production & openings links and date cards. `/production` lists batches by date and status; `/production/<batch-id>` is the dedicated inspection page. Record the opening date, damaged quantity and optional note; good quantity is produced minus damaged. Three days after production is a suggested opening date, not a mandatory waiting period.

Opening results attach to the existing production entry in workspace JSONB. No SQL migration is required; older batches remain pending until inspected. Production totals are retained. Only damaged pieces are removed from available finished stock, once. Repeated identical saves are safe; finalized results cannot be overwritten. Dates cannot precede production or exceed today in Pakistan time. Damaged quantities cannot exceed available stock; reconcile previous dispatches first. Slab production now adds physical stock while keeping it unavailable for sale until opening is confirmed. Only good slabs are released. Girders retain their existing immediate availability. Gatepass validation recalculates availability from saved openings and dispatch records inside the transaction; frontend availability fields cannot bypass it. Older unconfirmed slab batches remain unavailable until inspected.

Record production permission controls the new pages and save action. Existing stock-only and financial permissions remain unchanged. Raw materials, customer invoices and Cash/Bank are not changed by inspection. Historical finished-goods book value, when present, is reduced proportionally with a balanced non-cash Operating expenses / Finished goods inventory posting.

Checks: `node scripts/production-opening-check.mjs` covers quantities, dates, duplicate saves, legacy entries and permissions; `TEST_BASE_URL=http://localhost:3108 node scripts/production-opening-smoke.mjs` exercises dedicated routes, PostgreSQL persistence, dispatch and split payment collection using a disposable account.


Slab sale availability is now derived from confirmed-good opening quantities, pending batches and historical dispatches. Production creates Opening Pending stock. Opening Completed releases only good pieces. Damaged pieces are removed once and cannot be sold. Gatepasses reject requests above sellable stock inside the locked PostgreSQL transaction, including repeated product rows and forged client availability. Dashboard, Stocks, product picker and CSV exports show available-for-sale separately from opening-pending/damaged quantities. Existing unconfirmed slab batches require inspection; they are not automatically marked good. Girder availability is unchanged. `scripts/stock-availability-check.mjs` covers pending-sale rejection, damage, mixed batches, legacy records, cache safety and girder compatibility.


## Percentage discounts and direct invoice export
Gatepass uses Discount (%) from 0 to 100, up to two decimal places. The server computes the rounded rupee discount from the subtotal, then validates payments against the net invoice amount. Walk-in discounts remain disabled. Existing invoices keep their saved discount amounts; legacy rupee-discount API requests remain compatible.

Export invoice opens a custom preview modal from Gatepass or the customer ledger. Download PDF generates the factory-branded invoice directly, including multiple products, percentage/amount discount, payment split and remaining balance. It does not call browser print. Embedded Noto Sans fonts (SIL OFL, included under public/fonts) and optional cached factory logos are used; long invoices paginate with repeating table headers. No extra environment variables or database migrations are needed. The Import standard sizes panel includes its own Close control.
