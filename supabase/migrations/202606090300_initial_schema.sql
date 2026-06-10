create extension if not exists "pgcrypto";

do $$ begin
  create type customer_language as enum ('zh', 'en', 'ms');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type customer_status as enum ('active', 'blocked', 'suspended');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type conversation_status as enum ('open', 'pending', 'resolved', 'closed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type conversation_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type message_sender_type as enum ('customer', 'agent', 'system');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type message_type as enum ('text', 'file', 'system');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type login_actor_type as enum ('customer', 'agent');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type login_result as enum ('success', 'failed');
exception when duplicate_object then null;
end $$;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  phone text not null,
  password_hash text not null,
  internal_name text not null,
  preferred_language customer_language not null default 'zh',
  status customer_status not null default 'active',

  external_id text,
  full_name text,
  locale text,
  timezone text,
  metadata jsonb not null default '{}'::jsonb,

  constraint customers_phone_not_blank_chk check (length(trim(phone)) > 0),
  constraint customers_password_hash_not_blank_chk check (length(trim(password_hash)) > 0)
);

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  auth_user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  avatar_url text,
  role text not null default 'agent',
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,

  constraint agents_email_format_chk
    check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  customer_id uuid not null references customers(id) on delete restrict,
  assigned_agent_id uuid references agents(id) on delete set null,

  subject text,
  status conversation_status not null default 'open',
  priority conversation_priority not null default 'normal',
  channel text not null default 'web',
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  conversation_id uuid not null references conversations(id) on delete restrict,
  customer_id uuid references customers(id) on delete set null,
  agent_id uuid references agents(id) on delete set null,

  sender_type message_sender_type not null,
  type message_type not null default 'text',
  body text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,

  constraint messages_sender_identity_chk check (
    (sender_type = 'customer' and customer_id is not null and agent_id is null)
    or
    (sender_type = 'agent' and agent_id is not null and customer_id is null)
    or
    (sender_type = 'system' and customer_id is null and agent_id is null)
  )
);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  message_id uuid not null references messages(id) on delete restrict,
  file_url text not null,
  file_type text not null,
  file_size bigint not null,

  constraint attachments_file_url_not_blank_chk check (length(trim(file_url)) > 0),
  constraint attachments_file_type_not_blank_chk check (length(trim(file_type)) > 0),
  constraint attachments_file_size_positive_chk check (file_size > 0)
);

create table if not exists customer_notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  customer_id uuid not null references customers(id) on delete restrict,
  agent_id uuid references agents(id) on delete set null,

  title text,
  body text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists internal_notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  conversation_id uuid not null references conversations(id) on delete restrict,
  agent_id uuid references agents(id) on delete set null,

  body text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists customer_tags (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  customer_id uuid not null references customers(id) on delete restrict,
  created_by_agent_id uuid references agents(id) on delete set null,

  name text not null,
  color text,
  metadata jsonb not null default '{}'::jsonb,

  constraint customer_tags_name_not_blank_chk check (length(trim(name)) > 0)
);

create table if not exists login_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  actor_type login_actor_type not null,
  customer_id uuid references customers(id) on delete set null,
  agent_id uuid references agents(id) on delete set null,

  result login_result not null,
  ip_address inet,
  user_agent text,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,

  constraint login_logs_actor_identity_chk check (
    (actor_type = 'customer' and customer_id is not null and agent_id is null)
    or
    (actor_type = 'agent' and agent_id is not null and customer_id is null)
  )
);

create trigger trg_customers_updated_at
before update on customers
for each row execute function set_updated_at();

create trigger trg_agents_updated_at
before update on agents
for each row execute function set_updated_at();

create trigger trg_conversations_updated_at
before update on conversations
for each row execute function set_updated_at();

create trigger trg_messages_updated_at
before update on messages
for each row execute function set_updated_at();

create trigger trg_attachments_updated_at
before update on attachments
for each row execute function set_updated_at();

create trigger trg_customer_notes_updated_at
before update on customer_notes
for each row execute function set_updated_at();

create trigger trg_internal_notes_updated_at
before update on internal_notes
for each row execute function set_updated_at();

create trigger trg_customer_tags_updated_at
before update on customer_tags
for each row execute function set_updated_at();

create trigger trg_login_logs_updated_at
before update on login_logs
for each row execute function set_updated_at();

create unique index idx_customers_phone_active_unique
on customers (phone)
where deleted_at is null;

create unique index idx_customers_external_id_active_unique
on customers (external_id)
where external_id is not null and deleted_at is null;

create index idx_customers_status
on customers (status)
where deleted_at is null;

create index idx_customers_internal_name
on customers (internal_name)
where deleted_at is null;

create unique index idx_agents_email_active_unique
on agents (lower(email))
where deleted_at is null;

create unique index idx_agents_auth_user_id_active_unique
on agents (auth_user_id)
where auth_user_id is not null and deleted_at is null;

create index idx_agents_active
on agents (is_active)
where deleted_at is null;

create index idx_conversations_customer_id
on conversations (customer_id)
where deleted_at is null;

create index idx_conversations_assigned_agent_id
on conversations (assigned_agent_id)
where deleted_at is null;

create index idx_conversations_status_priority
on conversations (status, priority)
where deleted_at is null;

create index idx_conversations_last_message_at
on conversations (last_message_at desc)
where deleted_at is null;

create index idx_messages_conversation_created_at
on messages (conversation_id, created_at)
where deleted_at is null;

create index idx_messages_customer_id
on messages (customer_id)
where customer_id is not null and deleted_at is null;

create index idx_messages_agent_id
on messages (agent_id)
where agent_id is not null and deleted_at is null;

create index idx_attachments_message_id
on attachments (message_id)
where deleted_at is null;

create index idx_attachments_file_type
on attachments (file_type)
where deleted_at is null;

create index idx_customer_notes_customer_id
on customer_notes (customer_id, created_at desc)
where deleted_at is null;

create index idx_internal_notes_conversation_id
on internal_notes (conversation_id, created_at desc)
where deleted_at is null;

create unique index idx_customer_tags_customer_name_active_unique
on customer_tags (customer_id, lower(name))
where deleted_at is null;

create index idx_customer_tags_name
on customer_tags (lower(name))
where deleted_at is null;

create index idx_login_logs_customer_id_created_at
on login_logs (customer_id, created_at desc)
where customer_id is not null;

create index idx_login_logs_agent_id_created_at
on login_logs (agent_id, created_at desc)
where agent_id is not null;

create index idx_login_logs_result_created_at
on login_logs (result, created_at desc);

create index idx_login_logs_ip_address
on login_logs (ip_address);
