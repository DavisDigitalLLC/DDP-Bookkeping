-- DDP Bookkeeping: initial schema
-- Run this in Supabase SQL Editor (or via `supabase db push` once the CLI is linked).

-- ---------------------------------------------------------------------------
-- Helper: keep updated_at current on every row update
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- users (profile data; auth itself is handled by Supabase Auth / auth.users)
-- ---------------------------------------------------------------------------
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email varchar not null,
  full_name varchar,
  company_name varchar,
  tax_id varchar, -- EIN/SSN; treat as sensitive, restrict access via RLS
  accounting_method varchar not null default 'cash' check (accounting_method in ('cash', 'accrual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_users_updated_at
  before update on users
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- expense_categories
-- ---------------------------------------------------------------------------
create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  category_name varchar not null,
  category_code varchar not null,
  is_tax_deductible boolean not null default true,
  tax_line_item varchar,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_code)
);

create index idx_expense_categories_user on expense_categories(user_id);

create trigger trg_expense_categories_updated_at
  before update on expense_categories
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- product_lines (Service Line -> Department -> Product)
-- ---------------------------------------------------------------------------
create table product_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  service_line varchar not null,
  department varchar,
  product_name varchar not null,
  product_slug varchar not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, service_line, department, product_slug)
);

create index idx_product_lines_user on product_lines(user_id);

create trigger trg_product_lines_updated_at
  before update on product_lines
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- books (optional sub-products under KDP Publishing)
-- ---------------------------------------------------------------------------
create table books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  product_line_id uuid not null references product_lines(id) on delete cascade,
  book_title varchar not null,
  isbn varchar,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, isbn)
);

create index idx_books_user on books(user_id);
create index idx_books_product_line on books(product_line_id);

create trigger trg_books_updated_at
  before update on books
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- chart_of_accounts
-- ---------------------------------------------------------------------------
create table chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  account_number varchar not null,
  account_name varchar not null,
  account_type varchar not null check (account_type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  account_class varchar,
  parent_account_id uuid references chart_of_accounts(id) on delete set null,
  is_active boolean not null default true,
  normal_balance varchar not null check (normal_balance in ('debit', 'credit')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, account_number)
);

create index idx_coa_user on chart_of_accounts(user_id);
create index idx_coa_parent on chart_of_accounts(parent_account_id);

create trigger trg_coa_updated_at
  before update on chart_of_accounts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- receipts
-- ---------------------------------------------------------------------------
create table receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  file_url varchar not null,
  file_name varchar,
  file_size int,
  extracted_vendor varchar,
  extracted_date date,
  extracted_amount numeric(12,2),
  extracted_items jsonb,
  ocr_confidence numeric(3,2),
  user_review_status varchar not null default 'pending_review'
    check (user_review_status in ('pending_review', 'confirmed', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_receipts_user on receipts(user_id);

create trigger trg_receipts_updated_at
  before update on receipts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- transactions (GL entries)
-- ---------------------------------------------------------------------------
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  product_line_id uuid references product_lines(id) on delete set null,
  book_id uuid references books(id) on delete set null,
  transaction_date date not null,
  posted_date date not null default current_date,
  description varchar,
  receipt_id uuid references receipts(id) on delete set null,
  debit_account_id uuid not null references chart_of_accounts(id),
  credit_account_id uuid not null references chart_of_accounts(id),
  amount numeric(12,2) not null check (amount > 0),
  expense_category_id uuid references expense_categories(id) on delete set null,
  is_tax_deductible boolean,
  status varchar not null default 'draft' check (status in ('draft', 'posted', 'reconciled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (debit_account_id <> credit_account_id)
);

create index idx_transactions_user on transactions(user_id);
create index idx_transactions_date on transactions(transaction_date);
create index idx_transactions_product_line on transactions(product_line_id);
create index idx_transactions_debit_account on transactions(debit_account_id);
create index idx_transactions_credit_account on transactions(credit_account_id);
create index idx_transactions_status on transactions(status);

create trigger trg_transactions_updated_at
  before update on transactions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- bank_accounts
-- ---------------------------------------------------------------------------
create table bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  account_name varchar not null,
  account_type varchar not null check (account_type in ('checking', 'savings', 'credit_card', 'money_market')),
  gl_account_id uuid references chart_of_accounts(id),
  plaid_account_id varchar,
  last_sync timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bank_accounts_user on bank_accounts(user_id);

create trigger trg_bank_accounts_updated_at
  before update on bank_accounts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- bank_transactions
-- ---------------------------------------------------------------------------
create table bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  external_id varchar,
  transaction_date date not null,
  description varchar,
  amount numeric(12,2) not null,
  gl_transaction_id uuid references transactions(id) on delete set null,
  status varchar not null default 'pending' check (status in ('pending', 'matched', 'reconciled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bank_account_id, external_id)
);

create index idx_bank_transactions_user on bank_transactions(user_id);
create index idx_bank_transactions_bank_account on bank_transactions(bank_account_id);
create index idx_bank_transactions_status on bank_transactions(status);

create trigger trg_bank_transactions_updated_at
  before update on bank_transactions
  for each row execute function set_updated_at();
