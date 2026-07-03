# DDP Bookkeeping – Accounting Platform for Davis Digital & Publishing LLC
## Complete Project Specification & Claude Code Handoff

**Project Owner:** Joshua Davis (GigaDad)  
**Project Name:** DDP Bookkeeping  
**Scope:** Full accounting platform (cash-basis, GL, P&L, balance sheet, cash flow)  
**MVP Timeline:** 6-8 weeks  
**Target Users:** Solo self-employed, multiple product lines, manual bank reconciliation  

---

## 1. Project Overview

DDP Bookkeeping is a web-based accounting platform designed for solo self-employed users managing multiple product lines across service lines and departments (e.g., KDP publishing, mobile apps, web applications, consulting). It combines receipt scanning OCR, manual expense entry, bank transaction reconciliation, and full financial statement generation (P&L, balance sheet, cash flow) with hierarchical revenue/expense tracking by service line, department, and product.

### Key Features (MVP)
- Receipt scanning with OCR (auto-extract date, vendor, amount)
- Manual transaction entry (expenses, revenue)
- Expense categorization with tax deductibility flag
- Chart of Accounts management (unlimited accounts, hierarchical)
- Bank transaction import & reconciliation
- Hierarchical product line tracking (Service Line → Department → Product → Sub-Product)
- Hierarchical revenue/expense P&L (by service line, department, product)
- Tax deductible vs. non-deductible expense breakdown
- Estimated self-employment tax calculation & quarterly projections
- Monthly P&L report (by overall + by service line/department/product)
- Balance sheet snapshot
- Cash flow statement
- Dashboard with key metrics & tax estimates
- Tax filing export (organized for Schedule C self-filing)

### Tech Stack
- **Frontend:** React (web app)
- **Database:** PostgreSQL (via Supabase)
- **Backend:** Supabase (REST APIs + real-time sync)
- **Authentication:** Supabase Auth
- **File Storage:** Supabase Storage (for receipt images)
- **OCR:** OpenAI Vision API (or Tesseract.js for local processing)
- **Deployment:** Vercel (frontend) + Supabase (backend)

---

## 2. Database Schema

### Entity Relationship Overview

```
Users
├── Service Lines (Digital, Publishing)
│   └── Departments (Mobile Applications, Web Based)
│       └── Products (DinkUp, EverydayBible, AppealPath, DDP Bookkeeping, KDP Publishing)
│           └── Sub-Products (e.g., individual books under KDP Publishing)
├── Chart of Accounts (GL accounts)
├── Transactions (GL entries)
├── Bank Accounts (linked for reconciliation)
└── Receipts (uploaded images)
```

### Table Definitions

#### **users**
Tracks account owners. (Supabase Auth handles authentication; this table stores profile data.)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key (from Supabase Auth) |
| email | VARCHAR | User email |
| full_name | VARCHAR | Display name |
| company_name | VARCHAR | LLC name (e.g., "Davis Digital & Publishing LLC") |
| tax_id | VARCHAR | EIN or SSN for tax reports (encrypted) |
| accounting_method | ENUM | 'cash' or 'accrual' |
| created_at | TIMESTAMP | Account creation |
| updated_at | TIMESTAMP | Last profile update |

#### **expense_categories**
Predefined expense categories with tax deductibility flags.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| category_name | VARCHAR | Display name (e.g., "Office Supplies", "Software Subscriptions") |
| category_code | VARCHAR | Unique identifier |
| is_tax_deductible | BOOLEAN | Is this expense deductible? |
| tax_line_item | VARCHAR | IRS Schedule C line item (e.g., "8a. Supplies", "27. Other Expenses") |
| description | TEXT | Category guidelines |
| is_active | BOOLEAN | Include in dropdown? |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**Unique constraint:** (user_id, category_code)

**Pre-populated categories (on user signup):**
- Office Supplies (deductible)
- Software Subscriptions (deductible)
- Website Hosting (deductible)
- Domain Registration (deductible)
- Marketing & Advertising (deductible)
- Professional Services (deductible)
- Equipment < $2,500 (deductible)
- Meals & Entertainment (50% deductible, flag for manual adjustment)
- Travel (deductible)
- Phone & Internet (business portion, deductible)
- Personal Expenses (NOT deductible)
- Meals & Entertainment (already covered above)

#### **product_lines** (Updated)
Renamed from product_lines to reflect hierarchical structure.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| service_line | VARCHAR | Top level (e.g., "Digital", "Publishing") |
| department | VARCHAR | Department within service line (e.g., "Mobile Applications", "Web Based") |
| product_name | VARCHAR | Product name (e.g., "DinkUp", "AppealPath", "DDP Bookkeeping", "KDP Publishing") |
| product_slug | VARCHAR | URL-safe identifier |
| description | TEXT | Optional notes |
| is_active | BOOLEAN | Include in reports? |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**Unique constraint:** (user_id, service_line, department, product_slug)

**Pre-populated on signup:**
```
Service Line: Digital
├── Department: Mobile Applications
│   ├── DinkUp
│   ├── EverydayBible
│   └── AppealPath
└── Department: Web Based
    └── DDP Bookkeeping

Service Line: Publishing
└── Department: (default or none)
    └── KDP Publishing
```

#### **books** (Optional, under KDP Publishing)
Individual books under KDP Publishing for granular revenue tracking.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| product_line_id | UUID | FK → product_lines (KDP Publishing) |
| book_title | VARCHAR | Title |
| isbn | VARCHAR | ISBN-13 (unique identifier) |
| description | TEXT | Optional notes |
| is_active | BOOLEAN | Track in reports? |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**Unique constraint:** (user_id, isbn)

#### **chart_of_accounts**
Master list of GL accounts. Hierarchical with account types.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| account_number | VARCHAR | Unique ID (e.g., "1000" for assets) |
| account_name | VARCHAR | Display name (e.g., "Cash in Bank") |
| account_type | ENUM | 'asset', 'liability', 'equity', 'revenue', 'expense' |
| account_class | VARCHAR | Subclass (e.g., 'current_asset', 'fixed_asset', 'cost_of_goods_sold', 'operating_expense') |
| parent_account_id | UUID | FK → chart_of_accounts (for hierarchy) |
| is_active | BOOLEAN | Include in reports? |
| normal_balance | ENUM | 'debit' or 'credit' (determines balance calculation) |
| description | TEXT | Optional notes |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**Unique constraint:** (user_id, account_number)

**Account Types & Normal Balances:**
- Assets: Normal balance = Debit (increase with debit)
- Liabilities: Normal balance = Credit (increase with credit)
- Equity: Normal balance = Credit
- Revenue: Normal balance = Credit (income increases with credit)
- Expenses: Normal balance = Debit (expenses increase with debit)

#### **transactions**
General ledger entries. Every transaction is a debit to one account and a credit to another.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| product_line_id | UUID | FK → product_lines (NULL if multi-product or overhead) |
| book_id | UUID | FK → books (optional, for KDP revenue per book) |
| transaction_date | DATE | When the transaction occurred |
| posted_date | DATE | When it was recorded in GL |
| description | VARCHAR | Transaction memo |
| receipt_id | UUID | FK → receipts (optional) |
| debit_account_id | UUID | FK → chart_of_accounts (account debited) |
| credit_account_id | UUID | FK → chart_of_accounts (account credited) |
| amount | DECIMAL(12,2) | Transaction amount |
| expense_category_id | UUID | FK → expense_categories (if this is an expense) |
| is_tax_deductible | BOOLEAN | Is this expense tax deductible? |
| status | ENUM | 'draft', 'posted', 'reconciled' |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**Rules:**
- Debit amount + credit amount must be equal (enforced in business logic)
- Every posted transaction links two accounts
- Status 'draft' = user is editing; 'posted' = locked in GL; 'reconciled' = matched to bank tx
- For expenses, expense_category_id and is_tax_deductible should be populated

#### **receipts**
Uploaded receipt images and extracted data.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| file_url | VARCHAR | Supabase Storage path |
| file_name | VARCHAR | Original filename |
| file_size | INT | Size in bytes |
| extracted_vendor | VARCHAR | OCR-extracted vendor name |
| extracted_date | DATE | OCR-extracted transaction date |
| extracted_amount | DECIMAL(12,2) | OCR-extracted total |
| extracted_items | JSONB | Line items (if available) |
| ocr_confidence | DECIMAL(3,2) | Confidence score (0–1) |
| user_review_status | ENUM | 'pending_review', 'confirmed', 'rejected' |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### **bank_accounts**
Linked bank accounts for reconciliation.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| account_name | VARCHAR | Display name (e.g., "Checking – Wells Fargo") |
| account_type | ENUM | 'checking', 'savings', 'credit_card', 'money_market' |
| gl_account_id | UUID | FK → chart_of_accounts (the GL account this syncs to) |
| plaid_account_id | VARCHAR | Plaid integration ID (if connected) |
| last_sync | TIMESTAMP | Last transaction import |
| is_active | BOOLEAN | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### **bank_transactions**
Imported bank transactions pending reconciliation.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| bank_account_id | UUID | FK → bank_accounts |
| external_id | VARCHAR | Bank's transaction ID (for idempotency) |
| transaction_date | DATE | When bank recorded it |
| description | VARCHAR | Bank description |
| amount | DECIMAL(12,2) | Positive = debit, negative = credit |
| gl_transaction_id | UUID | FK → transactions (once reconciled) |
| status | ENUM | 'pending', 'matched', 'reconciled' |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**Rules:**
- Imported but not yet matched to GL = 'pending'
- User matches it to a GL transaction = 'matched'
- Month closed = 'reconciled'

---

## 3. Accounting Logic (GL Engine)

### Double-Entry Bookkeeping Rules

Every transaction consists of:
- **Debit:** Amount added to the debit account
- **Credit:** Amount subtracted from the credit account
- **Constraint:** Debits = Credits (always balanced)

### Account Balance Calculation

```
Account Balance = 
  SUM(amount WHERE account is debited) 
  - SUM(amount WHERE account is credited)
  * (normal_balance == 'debit' ? 1 : -1)
```

Example:
- Cash account (asset, normal balance = debit)
  - Debited: $1,000 (increases balance)
  - Credited: $300 (decreases balance)
  - Balance: $1,000 - $300 = $700

### General Ledger Posting

When a user enters a transaction (e.g., "paid $50 for office supplies"):
1. Verify both accounts exist and are active
2. Create transaction record with debit_account, credit_account, amount
3. Set status = 'posted'
4. Recalculate affected account balances

### P&L Calculation (Hierarchical by Service Line → Department → Product)

**Structure:**
```
REVENUE
├── Service Line: Digital
│   ├── Department: Mobile Applications
│   │   ├── Product: DinkUp: $X
│   │   ├── Product: EverydayBible: $X
│   │   └── Product: AppealPath: $X
│   │   Subtotal: $X
│   └── Department: Web Based
│       └── Product: DDP Bookkeeping: $X
│       Subtotal: $X
│   Service Line Subtotal: $X
└── Service Line: Publishing
    └── Department: (default)
        ├── Product: KDP Publishing
        │   ├── Book: Title 1 (ISBN-123): $X
        │   ├── Book: Title 2 (ISBN-456): $X
        │   └── ...
        │   Subtotal: $X
        └── Service Line Subtotal: $X

TOTAL REVENUE: $X

EXPENSES (same hierarchical structure)
├── Service Line: Digital
│   ├── Department: Mobile Applications
│   │   ├── Product: DinkUp
│   │   │   ├── Deductible Expenses: $X
│   │   │   └── Non-Deductible Expenses: $X
│   │   │   Subtotal: $X
│   │   ├── Product: EverydayBible: $X
│   │   └── Product: AppealPath: $X
│   │   Subtotal: $X
│   └── Department: Web Based
│       └── Product: DDP Bookkeeping: $X
│       Subtotal: $X
│   Service Line Subtotal: $X
└── Service Line: Publishing
    └── Service Line Subtotal: $X

TOTAL DEDUCTIBLE EXPENSES: $X
TOTAL NON-DEDUCTIBLE EXPENSES: $X
TOTAL EXPENSES: $X

NET INCOME (PROFIT): $X (= Gross Revenue - Total Expenses)
NET TAXABLE INCOME: $X (= Gross Revenue - Deductible Expenses)
ESTIMATED SE TAX: $X
```

**Calculation:**
```
Revenue by Product = SUM(transactions WHERE account_type='revenue' AND product_line_id=X)
Expense by Product = SUM(transactions WHERE account_type='expense' AND product_line_id=X)
Net by Product = Revenue - Expense

Deductible Expenses = SUM(transactions WHERE is_tax_deductible=true)
Non-Deductible Expenses = SUM(transactions WHERE is_tax_deductible=false)
Net Taxable Income = Revenue - Deductible Expenses
```

### Balance Sheet Calculation

```
Balance Sheet (as of a specific date) =
  Assets
  - Liabilities
  = Equity (retained earnings + current period P&L)
```

Constraint: Assets = Liabilities + Equity (always balanced)

### Tax Calculation (Self-Employment Tax Estimation)

**Self-Employment Tax (SE Tax):**
```
SE Tax = 15.3% × 92.35% × Net Income from Self-Employment

Where Net Income = Gross Revenue - Deductible Expenses
```

**Quarterly Estimated Tax Payment:**
```
Quarterly Estimate = (Annual Net Income × 15.3% × 92.35%) / 4
```

**Dashboard Alert:**
Show current year-to-date SE tax liability and next quarterly estimated payment.

**Tax Deductible vs. Non-Deductible Breakdown:**
- P&L should show both gross revenue and net deductible expenses separately
- Example:
  - Gross Revenue: $50,000
  - Deductible Expenses: $12,000
  - Non-Deductible Expenses: $2,000
  - Net Taxable Income: $38,000
  - Estimated SE Tax: $5,196
  - Quarterly Payment: $1,299

**Schedule C Preparation Export:**
Generate a CSV/PDF export suitable for Schedule C self-filing with:
- Gross revenue by product line
- Itemized deductible expenses by category
- Net profit
- Net SE tax liability

### Educational Content & Tax Strategy Guidance (In-App Tips & Guides)

**Voice & Tone:**
All tax guidance in the app should come from the perspective of a **creative, strategic accountant**—not an overly conservative tax advisor. The goal is to help users maximize legitimate deductions while staying defensible and well-documented.

**Key Principles:**
1. Deductions are legal tax strategy—the IRS doesn't expect users to leave money on the table
2. What matters is: (a) clear business purpose, (b) reasonable documentation, (c) consistency
3. Gray areas exist—explain them honestly with "conservative play" vs. "aggressive play" options
4. Emphasize that documentation > amount (IRS won't scrutinize $400 office supplies if you have receipts)

**Defensibility Framework:**
A deduction is defensible when:
- **Business Purpose:** Can explain why the expense supports the business
- **Documentation:** Receipt (screenshot OK) + brief note of what it's for
- **Consistency:** Same treatment year-over-year
- **Reasonableness:** Amount is proportional to business size/revenue
- **Precedent:** Similar businesses deduct similar items

**Sample Deduction Guide (Office Supplies & Equipment):**

```
OFFICE SUPPLIES & EQUIPMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CLEARLY DEDUCTIBLE
├── Pens, paper, notebooks, printer ink
├── Desk lamp, monitor, keyboard, mouse (~$200-500 items)
├── Software subscriptions (Adobe, Figma, Notion, ChatGPT, design tools)
├── Website hosting, domain names
├── Cloud storage (OneDrive, Google Drive for business use)
└── USB drives, cables, desk organizers

GRAY AREA (Context-Dependent)
├── Furniture ($300-1500 desk or chair)
│   → Conservative: Classify as equipment, depreciate over years
│   → Creative: Bundle as "office setup," deduct in one year if <$2,500
│   → Defensible if: You have a receipt, clear business purpose, consistent treatment
│
├── Standing desk ($600)
│   → Conservative: Equipment, depreciate
│   → Creative: Office ergonomic expense for home office health/productivity
│   → Reality: IRS rarely scrutinizes <$500 purchases if receipts exist
│
└── New computer/tablet ($1,500)
    → <$2,500: Can be immediately expensed (Section 179) or depreciated
    → >$2,500: Depreciate over 5 years
    → Practice: Most solo self-employed deduct fully if <$2,500 (defensible)

NOT DEDUCTIBLE
├── Personal furniture (couch, bed—unless in dedicated office)
├── Decorations, artwork
└── Anything already deducted elsewhere (don't double-dip)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STRATEGY TIPS

Bundle Purchases
  If buying: desk ($800) + monitor ($400) + keyboard ($200) + light ($150) + storage ($450)
  → Call it "office equipment setup" ($2,000), not individual big purchases
  → Keeps each item defensibly small; total is reasonable for business investment

Use Simplified Methods
  Home office: $5/sq ft simplified method (easier than tracking actual expenses)
  Mileage: IRS standard rate ($0.67/mile) vs. actual expense method—run both, pick better

Document Purpose & Amount
  Receipt + note: "MacBook Pro for app development (DDP Bookkeeping + AppealPath)"
  Specificity = defensibility

Consistency Over Time
  Whatever method you use year 1, use it year 2 (unless circumstances change)
  IRS wants to see a coherent system, not random changes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DEFENSIBILITY CHECK
  ✓ Is there a business purpose? (Can you explain why you need this?)
  ✓ Do you have a receipt? (Screenshot + saved email is fine)
  ✓ Is the amount reasonable? (Not excessive relative to your revenue)
  ✓ Is it consistent? (Same treatment as last year, or legitimate reason to change)
  
If yes to all four: You're defensible. IRS won't challenge it.
```

**Tone Examples (Creative vs. Conservative):**

Conservative:
> "Vehicle mileage is deductible only for client meetings and business travel."

Creative:
> "Track business mileage—client meetings, conferences, supply runs. Home office to coffee shop to work? Defensible if you're meeting a client or working on a client project. Home office to just work nearby? Technically commute, not deductible. Keep a log for the clear-cut ones; edge cases sort themselves out if your overall mileage pattern is reasonable."

---

Conservative:
> "Home office requires a dedicated room."

Creative:
> "Strict interpretation: dedicated, isolated room. But reality: if you use a corner of your bedroom exclusively for work, that's defensible. Simplified method ($5/sq ft) requires zero documentation. Actual expense method requires receipts but may save more money if utilities are high. Pick one, be consistent, you're fine."

---

Conservative:
> "Only deduct what's directly tied to revenue."

Creative:
> "Deduct what enables revenue. Accountant? Marketing software? Clearly tied. Business internet? Deduct the percentage you use for work. Coffee while writing? Edge case (50% meals rule). Professional development? Full deduction (you're building skills for the business). The IRS wants to see a system—not everything has to be directly generating revenue; it has to support the business."

**Content Implementation (In-App):**

1. **Tooltips on each deduction category** (in transaction entry)
   - One-line explanation using creative accountant perspective
   - Example: "Office supplies include any items <$500 that enable your work—pens, ink, software, monitors, desk organizers. The IRS doesn't scrutinize this category if you have receipts."

2. **Expandable guides** (click to learn more)
   - Full guide like the example above
   - Explains gray areas, strategy, when to be conservative vs. creative
   - Real-world examples for solo self-employed

3. **Annual Tax Parameter Updates (Manual):**
   - January each year: Joshua updates in admin panel
   - IRS SE tax rate (currently 15.3%)
   - Standard mileage rate (currently $0.67/mile for 2024)
   - Deduction limits (home office max $1,500 if simplified, etc.)
   - Equipment depreciation thresholds (Section 179 limit)
   - Update effort: ~30 minutes annually

---

## 4. Project Structure

```
ddp-books/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── Navigation.jsx
│   │   ├── Dashboard.jsx
│   │   ├── TransactionEntry.jsx (expense + income forms)
│   │   ├── ChartOfAccounts.jsx
│   │   ├── ReceiptScanner.jsx
│   │   ├── BankReconciliation.jsx
│   │   └── Reports/
│   │       ├── ProfitAndLoss.jsx
│   │       ├── BalanceSheet.jsx
│   │       └── CashFlow.jsx
│   ├── lib/
│   │   ├── supabaseClient.js (Supabase initialization)
│   │   ├── accountingEngine.js (GL logic: posting, balance calc, P&L gen)
│   │   ├── ocrService.js (receipt scanning via OpenAI or Tesseract)
│   │   └── reportGenerator.js (P&L, balance sheet, cash flow functions)
│   ├── hooks/
│   │   ├── useAuth.js (login/signup)
│   │   ├── useTransactions.js (fetch/post GL entries)
│   │   ├── useChartOfAccounts.js (fetch/manage COA)
│   │   └── useReports.js (fetch report data)
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Settings.jsx (product lines, COA, linked banks)
│   │   ├── Reports.jsx
│   │   └── Admin.jsx
│   ├── styles/
│   │   ├── index.css
│   │   └── components.css
│   ├── App.jsx
│   └── index.js
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── supabase/
    └── migrations/ (SQL schema files)
```

---

## 5. Setup Instructions (Before Claude Code)

### Step 1: Create GitHub Repo

1. Go to GitHub → New Repository
2. Name: `ddp-books`
3. Description: "Full accounting platform for solo self-employed with multiple product lines"
4. Make it **Private** (for now)
5. Click "Create repository"
6. Copy the HTTPS URL (e.g., `https://github.com/yourusername/ddp-books.git`)

### Step 2: Create Supabase Project

1. Go to Supabase Dashboard (https://app.supabase.com)
2. Click "New Project"
3. Name: `ddp-books`
4. Database Password: Generate a strong password (Supabase will provide one)
5. Region: Choose closest to you
6. Wait for project to initialize (~2 minutes)
7. Go to Settings → API → Copy the following:
   - **Project URL:** `https://[project-id].supabase.co`
   - **Anon Key:** (public, safe in frontend)
   - **Service Role Key:** (private, backend only)

### Step 3: Initialize Database Schema

In Supabase → SQL Editor:
- Create all tables from Section 2 above
- Add indexes for performance (on user_id, product_line_id, transaction_date, etc.)
- Set up Row Level Security (RLS) so users only see their own data

### Step 4: Set Up Environment Variables

Create `.env.local` in the React project root:

```
REACT_APP_SUPABASE_URL=https://[project-id].supabase.co
REACT_APP_SUPABASE_ANON_KEY=[your-anon-key]
REACT_APP_OPENAI_API_KEY=[your-openai-key-for-ocr]
```

(Never commit `.env.local` to GitHub—add to `.gitignore`)

### Step 5: Initialize React Project

```bash
# Clone the GitHub repo locally
git clone https://github.com/yourusername/ddp-books.git
cd ddp-books

# Initialize React
npx create-react-app . --template cra-template

# Install dependencies
npm install @supabase/supabase-js
npm install axios
npm install recharts (for charts in reports)
npm install date-fns (for date handling)
npm install tesseract.js (for OCR)

# Create .env.local (from Step 4 above)
```

---

## 6. Next Steps for Claude Code

Once GitHub repo + Supabase project are live and `.env.local` is configured:

1. **Verify Supabase connection** – Test that React can connect to Supabase
2. **Build authentication flow** – Login/signup with Supabase Auth
3. **Create default Chart of Accounts & Product Lines** – Seed COA + hierarchical product structure
4. **Build GL accounting engine** (`lib/accountingEngine.js`):
   - `postTransaction(debitAccountId, creditAccountId, amount, description, expenseCategoryId?, isTaxDeductible?)` – Posts a GL entry
   - `getAccountBalance(accountId, asOfDate)` – Calculates balance as of a date
   - `generateProfitAndLoss(periodStart, periodEnd, serviceLineFilter?, departmentFilter?, productFilter?)` – Returns hierarchical P&L data
   - `generateBalanceSheet(asOfDate)` – Returns balance sheet
   - `calculateSETax(netIncome)` – Calculates SE tax (15.3% × 92.35% × net income)
   - `generateQuarterlyTaxEstimate(yearToDateNetIncome)` – Suggests quarterly payment amounts
5. **Build transaction entry UI** – Form to manually enter expenses/income with tax deductibility flag
6. **Build educational content framework**:
   - Tooltips for each deduction category (creative accountant tone)
   - Expandable deduction guides (3+ samples: Office Supplies, Home Office, Vehicle Mileage)
   - Use the defensibility framework & tone examples from Section 3
7. **Build receipt scanner** – Upload image → Tesseract.js OCR extraction → auto-fill transaction form
8. **Build bank reconciliation** – Import bank tx → match to GL entries → mark reconciled
9. **Build reports dashboard** – Display hierarchical P&L, balance sheet, cash flow, SE tax estimates, quarterly payment recommendations
10. **Build tax export** – Generate Schedule C-formatted export (CSV/PDF) for self-filing

---

## 7. Initial Data Setup

When a new user signs up, auto-create:

### 1. Product Lines Structure

**Service Line: Digital**
- Department: Mobile Applications
  - DinkUp
  - EverydayBible
  - AppealPath
- Department: Web Based
  - DDP Bookkeeping

**Service Line: Publishing**
- Department: (default/none)
  - KDP Publishing

### 2. Default Chart of Accounts (standard template):
- **Assets:** Cash, Accounts Receivable, Equipment
- **Liabilities:** Accounts Payable, Credit Card, Loans
- **Equity:** Owner's Capital, Retained Earnings
- **Revenue:** Product Sales (Digital), Product Sales (Publishing), Services, Other Income
- **Expenses:** Cost of Goods Sold, Operating Expenses, Marketing, Professional Services, Supplies, Taxes

### 3. Expense Categories (with tax deductibility flags):

**Deductible:**
- Office Supplies
- Software Subscriptions
- Website Hosting
- Domain Registration
- Marketing & Advertising
- Professional Services
- Equipment (under $2,500)
- Travel
- Phone & Internet (business portion)

**Non-Deductible:**
- Personal Expenses

**Partially Deductible:**
- Meals & Entertainment (50%)

### 4. Default Bank Account (placeholder)
User can link their real bank account later via reconciliation

### 5. First Product Line (DDP Bookkeeping) Auto-Created
Since this is the accounting app itself, it should be pre-populated as a product line

---

## 8. Scope Boundaries (MVP)

### In Scope
- Receipt scanning with OCR (Tesseract.js)
- Manual transaction entry with tax deductibility flag
- Chart of Accounts management
- Bank reconciliation (manual import + matching)
- Expense category management with tax deductibility flags
- P&L by month (hierarchical by service line, department, product)
- Balance sheet
- Cash flow statement
- Dashboard with key metrics & SE tax estimates
- User authentication & profile
- **Educational content: Basic deduction tooltips & examples** (creative accountant tone)
- Tax export (Schedule C formatted)
- Quarterly tax payment recommendations

### Out of Scope (Post-MVP)
- Advanced tax strategy guides (expand post-launch based on user needs)
- Automatic tax parameter updates (manual annual updates only)
- Automatic bank import via Plaid API
- Invoice generation + AR tracking
- Bill payment workflows
- Advanced tax reporting templates
- Multi-user/team access
- Mobile app (web-only for MVP)
- API for third-party integrations

---

## 9. Deployment Plan

### Frontend (React)
- Deploy to Vercel (free tier available)
- Connect GitHub repo → Vercel will auto-deploy on push

### Backend (Supabase)
- Supabase hosts everything (no separate backend needed)
- RLS policies enforce user data isolation

### Secrets Management
- Store `.env.local` locally during dev
- In Vercel, add environment variables via dashboard
- Never commit keys to GitHub

---

## 10. Clarifications & Decisions Made

**OCR Processing:**
- Using Tesseract.js for local OCR (no OpenAI API key needed)
- Trade-off: Potentially lower accuracy than OpenAI Vision, but free and local
- User can manually edit OCR results before posting

**Product Line Structure:**
- Auto-created on signup with full hierarchy (Service Line → Department → Product)
- Users can add sub-products (e.g., individual books under KDP Publishing)

**Tax Tracking:**
- Option 1: Basic tax tracking (expense deductibility flag, SE tax estimation)
- User files taxes themselves (no need for complex tax compliance features)
- Quarterly estimated tax payments displayed on dashboard
- Export data formatted for Schedule C self-filing

**Remaining Questions for Claude Code:**

1. **Should the app support multi-currency?**
   - Recommendation: No for MVP (USD only)

2. **Should transactions support multi-debit/multi-credit entries?**
   - MVP: No (single debit account, single credit account per transaction)
   - Future: Yes if needed

3. **Should the app support recurring transactions (auto-post monthly subscriptions)?**
   - MVP: No (manual entry each time)
   - Future: Yes if high demand

4. **How should overhead/indirect expenses be allocated across product lines?**
   - MVP: User manually assigns to a product line or creates an "Overhead" product line
   - Future: Intelligent allocation rules if needed

---

## 11. Known Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Complex GL logic is error-prone | Write unit tests for GL calculations; verify with sample transactions |
| OCR accuracy varies by receipt quality | Show confidence score; require user review before posting |
| Supabase RLS misconfiguration leaks data | Test RLS policies thoroughly before launch |
| Float precision in currency calculations | Use DECIMAL(12,2) in DB; avoid floating-point math in JavaScript |
| User deletes/edits posted transactions | Implement audit log; mark as "void" instead of delete; lock after reconciliation |

---

## 12. Success Metrics (MVP)

- [ ] User can sign up and log in
- [ ] User can view auto-created product lines (hierarchical structure) and Chart of Accounts
- [ ] User can enter an expense transaction with tax deductibility flag
- [ ] GL balance updates correctly after posting
- [ ] User can upload a receipt, see Tesseract.js OCR extraction, and confirm it posts
- [ ] User can reconcile a bank transaction to a GL entry
- [ ] User can generate a monthly P&L (hierarchical by service line, department, product)
- [ ] User can generate a balance sheet
- [ ] User can generate a cash flow statement
- [ ] Dashboard shows key metrics (current month P&L, account balances, cash position, estimated SE tax)
- [ ] Dashboard shows quarterly estimated tax payment recommendations
- [ ] User can export Schedule C-formatted data for tax filing
- [ ] Deduction category entries include tooltips with creative accountant perspective
- [ ] At least 3 sample deduction guides available (expandable from tooltips)

---

## 13. Timeline (6-8 Weeks)

| Week | Milestone |
|------|-----------|
| 1 | Auth + GL engine + transaction entry (manual) + expense category setup |
| 2 | Receipt scanner + Tesseract.js OCR integration |
| 2-3 | Educational content: Deduction tooltips + 3 sample guides (Office Supplies, Home Office, Mileage) |
| 3 | Bank reconciliation + tax deductibility tracking |
| 3-4 | Reports (hierarchical P&L, balance sheet, cash flow) |
| 4 | Dashboard + SE tax estimates + quarterly payment calculator |
| 5 | Tax export (Schedule C formatted) |
| 5-6 | Testing, refinement, edge cases |
| 6-8 | Polish, deploy to Vercel, launch |

---

## 14. Setup Credentials & Final Handoff

**Credentials for Claude Code:**
- **Supabase Project URL:** https://gkbimpgfaapfqaaxtobb.supabase.co
- **Supabase Anon Key:** [provided separately, safe in frontend]
- **Supabase Service Role Key:** [provided separately, backend/env only, NEVER in GitHub]
- **GitHub Repo URL:** https://github.com/DavisDigitalLLC/DDP-Bookkeping.git

**Setup Decisions Confirmed:**
- ✅ App Name: DDP Bookkeeping
- ✅ OCR: Tesseract.js (local processing, no API key needed)
- ✅ Product Structure: Hierarchical auto-created on signup (Service Line → Department → Product → Sub-Product)
- ✅ Tax Tracking: Option 1 (basic deductibility + SE tax estimation)
- ✅ Tax Filing: User files themselves; export formatted for Schedule C
- ✅ Quarterly Tax Estimates: Display on dashboard with payment recommendations
- ✅ Educational Tone: Creative, strategic accountant (maximize legitimate deductions, explain gray areas)
- ✅ Annual Updates: Manual (Joshua updates tax rates, mileage, deduction limits each January)
- ✅ Revenue Model: TBD (MVP is personal use for Davis Digital & Publishing LLC)

**Ready for Claude Code:**
This spec is complete and ready to hand off. Claude Code should:
1. Review this entire specification (especially Section 3 on Educational Content & Tax Strategy Guidance)
2. Pay close attention to the creative accountant tone examples and defensibility framework
3. Ask clarifying questions if anything is ambiguous
4. Initialize the GitHub repo locally
5. Wire up Supabase authentication
6. Begin building in the order specified in Section 6

---

**This spec is the source of truth. Claude Code should refer to it constantly, especially Section 3 (Educational Content) when building in-app guidance.**
