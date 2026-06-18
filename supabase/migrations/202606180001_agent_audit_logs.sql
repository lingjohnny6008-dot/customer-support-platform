create table if not exists agent_audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  actor_agent_id uuid references agents(id) on delete set null,
  actor_role text not null,

  action text not null,

  conversation_id uuid references conversations(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  target_agent_id uuid references agents(id) on delete set null,
  message_id uuid references messages(id) on delete set null,
  internal_note_id uuid references internal_notes(id) on delete set null,
  tag_id uuid references customer_tags(id) on delete set null,

  old_value jsonb,
  new_value jsonb,
  metadata jsonb not null default '{}'::jsonb,

  constraint agent_audit_logs_actor_role_chk
    check (actor_role in ('agent', 'admin')),
  constraint agent_audit_logs_action_not_blank_chk
    check (length(trim(action)) > 0)
);

create index if not exists idx_agent_audit_logs_created_at
on agent_audit_logs (created_at desc);

create index if not exists idx_agent_audit_logs_actor_agent_id_created_at
on agent_audit_logs (actor_agent_id, created_at desc);

create index if not exists idx_agent_audit_logs_conversation_id_created_at
on agent_audit_logs (conversation_id, created_at desc)
where conversation_id is not null;

create index if not exists idx_agent_audit_logs_customer_id_created_at
on agent_audit_logs (customer_id, created_at desc)
where customer_id is not null;

create index if not exists idx_agent_audit_logs_action_created_at
on agent_audit_logs (action, created_at desc);
