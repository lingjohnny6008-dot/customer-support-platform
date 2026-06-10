create extension if not exists "pgcrypto";

alter table agents
  add column if not exists username text,
  add column if not exists password_hash text;

create unique index if not exists idx_agents_username_active_unique
on agents (lower(username))
where username is not null and deleted_at is null;

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

  if found_customer.status <> 'active' then
    insert into login_logs (actor_type, customer_id, result, failure_reason)
    values ('customer', found_customer.id, 'failed', 'customer_not_active');

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

create or replace function verify_staff_login(
  input_identifier text,
  input_password text,
  expected_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  found_agent agents%rowtype;
  is_password_valid boolean;
begin
  select *
  into found_agent
  from agents
  where deleted_at is null
    and (
      lower(email) = lower(input_identifier)
      or lower(username) = lower(input_identifier)
    )
  limit 1;

  if found_agent.id is null then
    return null;
  end if;

  if found_agent.is_active is false then
    insert into login_logs (actor_type, agent_id, result, failure_reason)
    values ('agent', found_agent.id, 'failed', 'agent_not_active');

    return null;
  end if;

  if found_agent.role <> expected_role then
    insert into login_logs (actor_type, agent_id, result, failure_reason)
    values ('agent', found_agent.id, 'failed', 'role_mismatch');

    return null;
  end if;

  if found_agent.password_hash is null then
    insert into login_logs (actor_type, agent_id, result, failure_reason)
    values ('agent', found_agent.id, 'failed', 'missing_password_hash');

    return null;
  end if;

  is_password_valid := found_agent.password_hash = crypt(input_password, found_agent.password_hash);

  if not is_password_valid then
    insert into login_logs (actor_type, agent_id, result, failure_reason)
    values ('agent', found_agent.id, 'failed', 'invalid_password');

    return null;
  end if;

  insert into login_logs (actor_type, agent_id, result)
  values ('agent', found_agent.id, 'success');

  return jsonb_build_object(
    'id', found_agent.id,
    'role', found_agent.role,
    'display_name', found_agent.full_name,
    'is_active', found_agent.is_active
  );
end;
$$;

revoke all on function verify_customer_login(text, text) from public;
revoke all on function verify_staff_login(text, text, text) from public;

grant execute on function verify_customer_login(text, text) to service_role;
grant execute on function verify_staff_login(text, text, text) to service_role;
