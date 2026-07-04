-- DDP Bookkeeping: month-end close. A closed period is a soft lock, not a
-- delete-blocking trigger -- transactions dated inside a closed month can't
-- be edited/deleted/posted through the app (enforced in the accounting
-- engine, checked against this table), but the period can always be
-- reopened for a correcting entry.

create table period_closes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  period_month date not null, -- always the first of the month, e.g. 2026-06-01
  closed_at timestamptz not null default now(),
  notes text,
  unique (user_id, period_month)
);

alter table period_closes enable row level security;

create policy "period_closes_select_own" on period_closes
  for select using (auth.uid() = user_id);
create policy "period_closes_insert_own" on period_closes
  for insert with check (auth.uid() = user_id);
create policy "period_closes_delete_own" on period_closes
  for delete using (auth.uid() = user_id);
