create extension if not exists "pgcrypto";

create or replace function create_agent_admin(
  input_username text,
  input_email text,
  input_password text,
  input_full_name text,
  input_role text,
  input_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_agent_id uuid;
begin
  if input_username is null or length(trim(input_username)) = 0 then
    raise exception 'username_required';
  end if;

  if input_email is null or length(trim(input_email)) = 0 then
    raise exception 'email_required';
  end if;

  if input_password is null or length(input_password) < 8 then
    raise exception 'password_min_length';
  end if;

  if input_full_name is null or length(trim(input_full_name)) = 0 then
    raise exception 'full_name_required';
  end if;

  if input_role not in ('admin', 'agent') then
    raise exception 'invalid_role';
  end if;

  insert into agents (
    username,
    email,
    password_hash,
    full_name,
    role,
    is_active
  )
  values (
    trim(input_username),
    trim(input_email),
    crypt(input_password, gen_salt('bf')),
    trim(input_full_name),
    input_role,
    coalesce(input_is_active, true)
  )
  returning id into new_agent_id;

  return new_agent_id;
end;
$$;

create or replace function reset_agent_password_admin(
  input_agent_id uuid,
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

  update agents
  set password_hash = crypt(input_password, gen_salt('bf'))
  where id = input_agent_id
    and deleted_at is null;

  if not found then
    raise exception 'agent_not_found';
  end if;
end;
$$;

revoke all on function create_agent_admin(text, text, text, text, text, boolean) from public;
revoke all on function reset_agent_password_admin(uuid, text) from public;

grant execute on function create_agent_admin(text, text, text, text, text, boolean) to service_role;
grant execute on function reset_agent_password_admin(uuid, text) to service_role;
