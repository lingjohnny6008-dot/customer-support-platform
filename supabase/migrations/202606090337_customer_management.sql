create extension if not exists "pgcrypto";

create or replace function create_customer_admin(
  input_phone text,
  input_password text,
  input_internal_name text,
  input_preferred_language customer_language,
  input_status customer_status
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
    status
  )
  values (
    trim(input_phone),
    crypt(input_password, gen_salt('bf')),
    trim(input_internal_name),
    input_preferred_language,
    input_status
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
  input_status customer_status
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
    status = input_status
  where id = input_customer_id
    and deleted_at is null;

  if not found then
    raise exception 'customer_not_found';
  end if;
end;
$$;

create or replace function reset_customer_password_admin(
  input_customer_id uuid,
  input_password text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if input_password is null or length(input_password) < 8 then
    raise exception 'password_min_length';
  end if;

  update customers
  set password_hash = crypt(input_password, gen_salt('bf'))
  where id = input_customer_id
    and deleted_at is null;

  if not found then
    raise exception 'customer_not_found';
  end if;
end;
$$;

revoke all on function create_customer_admin(text, text, text, customer_language, customer_status) from public;
revoke all on function update_customer_admin(uuid, text, text, customer_language, customer_status) from public;
revoke all on function reset_customer_password_admin(uuid, text) from public;

grant execute on function create_customer_admin(text, text, text, customer_language, customer_status) to service_role;
grant execute on function update_customer_admin(uuid, text, text, customer_language, customer_status) to service_role;
grant execute on function reset_customer_password_admin(uuid, text) to service_role;
