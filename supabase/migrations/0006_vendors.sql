-- DDP Bookkeeping: a real Vendors entity, so grouping expenses by vendor
-- survives a rename instead of relying on exact-match transaction
-- description text.

create table vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  vendor_name varchar not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, vendor_name)
);

create index idx_vendors_user on vendors(user_id);

create trigger trg_vendors_updated_at
  before update on vendors
  for each row execute function set_updated_at();

alter table vendors enable row level security;

create policy "vendors_select_own" on vendors
  for select using (user_id = auth.uid());
create policy "vendors_insert_own" on vendors
  for insert with check (user_id = auth.uid());
create policy "vendors_update_own" on vendors
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "vendors_delete_own" on vendors
  for delete using (user_id = auth.uid());

alter table transactions add column vendor_id uuid references vendors(id) on delete set null;
create index idx_transactions_vendor on transactions(vendor_id);
