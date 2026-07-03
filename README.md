# DDP Bookkeeping

Accounting platform for Davis Digital & Publishing LLC — cash-basis GL,
hierarchical P&L by service line / department / product, balance sheet, and
self-employment tax estimation. See `DDP_Books_Project_Spec.md` (handoff doc)
for the full product spec.

## One-time setup

1. **Apply the database schema.** Open the Supabase SQL Editor for this
   project (https://app.supabase.com → your project → SQL Editor) and run
   these three files **in order**:
   - `supabase/migrations/0001_initial_schema.sql`
   - `supabase/migrations/0002_rls_policies.sql`
   - `supabase/migrations/0003_seed_new_user.sql`

   This creates all tables, turns on Row Level Security so users only ever
   see their own data, and installs a trigger that auto-seeds a new signup
   with the default product lines, chart of accounts, and expense categories
   (spec Section 7).

2. **Environment variables.** `.env.local` is already populated with the
   Supabase project URL and anon key. Never commit it — it's gitignored.

3. **Install & run:**
   ```bash
   npm install
   npm start
   ```
   Opens at http://localhost:3000.

## What's built (Week 1 of the spec)

- Supabase Auth (email/password) with an `AuthProvider` gate around the app
- GL engine (`src/lib/accountingEngine.js`): `postTransaction`,
  `getAccountBalance`, `generateProfitAndLoss` (hierarchical by service
  line/department/product), `generateBalanceSheet`, `calculateSETax`,
  `generateQuarterlyTaxEstimate`
- Manual transaction entry (expense/income) with tax-deductibility flag and
  deduction tooltips
- Dashboard with current-month P&L, YTD SE tax estimate, and quarterly
  payment recommendation
- Chart of Accounts view with live balances
- Auto-seeded product lines, chart of accounts, and expense categories on
  signup (via a Postgres trigger, not client-side, so it can't be skipped)

## Not yet built (later weeks per spec)

Receipt scanning/OCR, bank reconciliation, balance sheet/cash flow report
pages, Schedule C export, educational guide content beyond inline tooltips.

## Project structure

```
src/
├── components/       Reusable UI: Navigation, TransactionEntry, ChartOfAccounts
├── hooks/             useAuth, useTransactions, useChartOfAccounts
├── lib/               supabaseClient, accountingEngine (GL logic)
├── pages/             Login, Dashboard, Transactions, Settings
└── styles/
supabase/migrations/  SQL schema, RLS policies, signup seed trigger
```
