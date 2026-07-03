-- DDP Bookkeeping: Row Level Security
-- Every table is scoped to auth.uid() so users can only ever see their own data.

alter table users enable row level security;
alter table expense_categories enable row level security;
alter table product_lines enable row level security;
alter table books enable row level security;
alter table chart_of_accounts enable row level security;
alter table receipts enable row level security;
alter table transactions enable row level security;
alter table bank_accounts enable row level security;
alter table bank_transactions enable row level security;

-- users: a user can only see/edit their own profile row
create policy "users_select_own" on users
  for select using (id = auth.uid());
create policy "users_insert_own" on users
  for insert with check (id = auth.uid());
create policy "users_update_own" on users
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "users_delete_own" on users
  for delete using (id = auth.uid());

-- Every other table follows the same owner-scoped pattern via user_id.
do $$
declare
  t text;
begin
  foreach t in array array[
    'expense_categories',
    'product_lines',
    'books',
    'chart_of_accounts',
    'receipts',
    'transactions',
    'bank_accounts',
    'bank_transactions'
  ]
  loop
    execute format(
      'create policy "%1$s_select_own" on %1$s for select using (user_id = auth.uid());', t
    );
    execute format(
      'create policy "%1$s_insert_own" on %1$s for insert with check (user_id = auth.uid());', t
    );
    execute format(
      'create policy "%1$s_update_own" on %1$s for update using (user_id = auth.uid()) with check (user_id = auth.uid());', t
    );
    execute format(
      'create policy "%1$s_delete_own" on %1$s for delete using (user_id = auth.uid());', t
    );
  end loop;
end $$;
