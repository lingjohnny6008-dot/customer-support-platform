alter table customers
  add column if not exists last_seen_at timestamptz;

create index if not exists idx_customers_last_seen_at
on customers (last_seen_at desc)
where deleted_at is null;
