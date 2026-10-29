# UI audit — 29 October 2026

Chrome extension browser, local production server; disposable populated workspace. Desktop default viewport and 390 × 844 mobile viewport; light and dark mode sampled across pages and dialogs.

## Coverage
- Login and signup visual inspection.
- Home, Stock & sizes, Raw materials, Sale/Bill, Cash & accounts, Customers, Expenses, Equipment/assets, Employees/Thakedaar, Settings, Team access and Slab opening routes visited.
- Mobile document widths measured across main workspaces: no document-level horizontal overflow observed; wide registers retain internal scrolling.
- Size create, production, material/trali receipt, sale/product picker, invoice preview, transfer, add funds, customer edit/payment, expense, employee edit/advance/salary preparation/salary payment/attendance popups opened.
- Employee/Thakedaar tabs, accounting reports, material settings tabs, import catalog, notification menu and mobile navigation checked.
- Populated stock, customer ledger, cash movements, pending slab inspection and salary records inspected. No business submissions made through the browser audit.

## Fixes
- Long popup action rows now remain inside the visible dialog, on desktop and mobile; negative sticky offsets previously clipped lower button edges.
- Notification text and count contrast made explicit.
- Mobile navigation now has Open/Close navigation labels and expanded state.
- Production filters, customer action groups and dimension guidance wrap on narrow screens.
- Product filter badge contrast normalized.

## Verification
- Production build and TypeScript passed after final changes.
- ESLint passed.
- Stock availability, gatepass/payment, payroll and PDF/export scripts passed.
- Final action-row bounds measured inside dialog/viewport at desktop and 390 × 844.
- Disposable workspace, test records and local temporary credentials removed. Normal viewport restored.

## Limits
This is a manual UI audit with representative light/dark and responsive combinations, not every possible data/state/device combination. Native upload chooser, actual logo upload, team invite/removal submissions, every export download and all validation-error combinations were not exercised in Chrome. Existing standalone PDF/payment/payroll scripts cover their stated logic; business logic was not modified. Browser console errors observed were from a chrome-extension share-modal script.
