alter table customers
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists country text,
  add column if not exists note_summary text;

create or replace function create_customer_admin(
  input_phone text,
  input_password text,
  input_internal_name text,
  input_preferred_language customer_language,
  input_status customer_status,
  input_full_name text default null,
  input_email text default null,
  input_country text default null,
  input_note_summary text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_customer_id uuid;
begin
  if input_phone is null or length(trim(input_phone)) = 0 then
    raise exception 'phone_required';
  end if;

  if input_password is null or length(input_password) < 8 then
    raise exception 'password_min_length';
  end if;

  if input_internal_name is null or length(trim(input_internal_name)) = 0 then
    raise exception 'internal_name_required';
  end if;

  insert into customers (
    phone,
    password_hash,
    internal_name,
    preferred_language,
    status,
    full_name,
    email,
    country,
    note_summary
  )
  values (
    trim(input_phone),
    crypt(input_password, gen_salt('bf')),
    trim(input_internal_name),
    input_preferred_language,
    input_status,
    nullif(trim(coalesce(input_full_name, '')), ''),
    nullif(trim(coalesce(input_email, '')), ''),
    nullif(trim(coalesce(input_country, '')), ''),
    nullif(trim(coalesce(input_note_summary, '')), '')
  )
  returning id into new_customer_id;

  return new_customer_id;
end;
$$;

create or replace function update_customer_admin(
  input_customer_id uuid,
  input_phone text,
  input_internal_name text,
  input_preferred_language customer_language,
  input_status customer_status,
  input_full_name text default null,
  input_email text default null,
  input_country text default null,
  input_note_summary text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if input_phone is null or length(trim(input_phone)) = 0 then
    raise exception 'phone_required';
  end if;

  if input_internal_name is null or length(trim(input_internal_name)) = 0 then
    raise exception 'internal_name_required';
  end if;

  update customers
  set
    phone = trim(input_phone),
    internal_name = trim(input_internal_name),
    preferred_language = input_preferred_language,
    status = input_status,
    full_name = nullif(trim(coalesce(input_full_name, '')), ''),
    email = nullif(trim(coalesce(input_email, '')), ''),
    country = nullif(trim(coalesce(input_country, '')), ''),
    note_summary = nullif(trim(coalesce(input_note_summary, '')), '')
  where id = input_customer_id
    and deleted_at is null;

  if not found then
    raise exception 'customer_not_found';
  end if;
end;
$$;

revoke all on function create_customer_admin(text, text, text, customer_language, customer_status, text, text, text, text) from public;
revoke all on function update_customer_admin(uuid, text, text, customer_language, customer_status, text, text, text, text) from public;

grant execute on function create_customer_admin(text, text, text, customer_language, customer_status, text, text, text, text) to service_role;
grant execute on function update_customer_admin(uuid, text, text, customer_language, customer_status, text, text, text, text) to service_role;
