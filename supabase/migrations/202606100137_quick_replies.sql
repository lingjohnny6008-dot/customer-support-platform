create table if not exists quick_replies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  title text not null,
  content text not null,
  is_active boolean not null default true,

  constraint quick_replies_title_not_blank_chk check (length(trim(title)) > 0),
  constraint quick_replies_content_not_blank_chk check (length(trim(content)) > 0)
);

create trigger trg_quick_replies_updated_at
before update on quick_replies
for each row execute function set_updated_at();

create unique index if not exists idx_quick_replies_title_active_unique
on quick_replies (lower(title))
where deleted_at is null;

create index if not exists idx_quick_replies_is_active
on quick_replies (is_active)
where deleted_at is null;
