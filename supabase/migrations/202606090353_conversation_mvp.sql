create or replace function touch_conversation_last_message_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update conversations
  set
    last_message_at = new.created_at,
    updated_at = now()
  where id = new.conversation_id
    and deleted_at is null;

  return new;
end;
$$;

drop trigger if exists trg_messages_touch_conversation on messages;
create trigger trg_messages_touch_conversation
after insert on messages
for each row execute function touch_conversation_last_message_at();

do $$
begin
  alter publication supabase_realtime add table conversations;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
