-- DDP Bookkeeping: let a product line carry a default GL account for
-- revenue and/or expense, so transaction entry can auto-fill the account
-- once a product is picked instead of requiring two independent choices
-- that have to be kept in sync by hand.

alter table product_lines
  add column default_revenue_account_id uuid references chart_of_accounts(id) on delete set null,
  add column default_expense_account_id uuid references chart_of_accounts(id) on delete set null;
