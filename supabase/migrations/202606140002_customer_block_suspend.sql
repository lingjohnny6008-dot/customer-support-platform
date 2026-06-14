create or replace function verify_customer_login(
  input_phone text,
  input_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  found_customer customers%rowtype;
  is_password_valid boolean;
begin
  select *
  into found_customer
  from customers
  where phone = input_phone
    and deleted_at is null
  limit 1;

  if found_customer.id is null then
    return null;
  end if;

  if found_customer.status = 'blocked' then
    insert into login_logs (actor_type, customer_id, result, failure_reason)
    values ('customer', found_customer.id, 'failed', 'customer_blocked');

    return null;
  end if;

  is_password_valid := found_customer.password_hash = crypt(input_password, found_customer.password_hash);

  if not is_password_valid then
    insert into login_logs (actor_type, customer_id, result, failure_reason)
    values ('customer', found_customer.id, 'failed', 'invalid_password');

    return null;
  end if;

  insert into login_logs (actor_type, customer_id, result)
  values ('customer', found_customer.id, 'success');

  return jsonb_build_object(
    'id', found_customer.id,
    'role', 'customer',
    'display_name', found_customer.phone,
    'status', found_customer.status
  );
end;
$$;

revoke all on function verify_customer_login(text, text) from public;
grant execute on function verify_customer_login(text, text) to service_role;
