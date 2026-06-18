alter table login_logs
  add column if not exists identifier text;

alter table login_logs
  alter column ip_address type text using ip_address::text;

drop index if exists idx_login_logs_identifier_attempts;

create index idx_login_logs_identifier_attempts
on login_logs (actor_type, identifier, result, created_at desc)
where deleted_at is null and identifier is not null;

alter table login_logs
  drop constraint if exists login_logs_actor_identity_chk;

alter table login_logs
  add constraint login_logs_actor_identity_chk check (
    (actor_type = 'customer' and agent_id is null)
    or
    (actor_type = 'agent' and customer_id is null)
  );

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
    return jsonb_build_object(
      'failure_reason', 'customer_blocked',
      'customer_id', found_customer.id
    );
  end if;

  is_password_valid := found_customer.password_hash = crypt(input_password, found_customer.password_hash);

  if not is_password_valid then
    return jsonb_build_object(
      'failure_reason', 'invalid_password',
      'customer_id', found_customer.id
    );
  end if;

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
    return jsonb_build_object(
      'failure_reason', 'agent_not_active',
      'agent_id', found_agent.id
    );
  end if;

  if found_agent.role <> expected_role then
    return jsonb_build_object(
      'failure_reason', 'role_mismatch',
      'agent_id', found_agent.id
    );
  end if;

  if found_agent.password_hash is null then
    return jsonb_build_object(
      'failure_reason', 'missing_password_hash',
      'agent_id', found_agent.id
    );
  end if;

  is_password_valid := found_agent.password_hash = crypt(input_password, found_agent.password_hash);

  if not is_password_valid then
    return jsonb_build_object(
      'failure_reason', 'invalid_password',
      'agent_id', found_agent.id
    );
  end if;

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
