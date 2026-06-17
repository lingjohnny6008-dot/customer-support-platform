alter table quick_replies
  add column if not exists category text not null default 'General';

update quick_replies
set category = 'General'
where category is null or length(trim(category)) = 0;

alter table quick_replies
  add constraint quick_replies_category_not_blank_chk
  check (length(trim(category)) > 0)
  not valid;

alter table quick_replies
  validate constraint quick_replies_category_not_blank_chk;

create index if not exists idx_quick_replies_category
on quick_replies (lower(category))
where deleted_at is null;
