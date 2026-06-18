import { createSupabaseAdminClient } from "@/lib/supabase";
import type { AgentAuditAction, AgentAuditLog, AuthRole } from "@/lib/types";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type CreateAgentAuditLogInput = {
  actorAgentId: string;
  actorRole: Extract<AuthRole, "agent" | "admin">;
  action: AgentAuditAction;
  conversationId?: string | null;
  customerId?: string | null;
  targetAgentId?: string | null;
  messageId?: string | null;
  internalNoteId?: string | null;
  tagId?: string | null;
  oldValue?: JsonValue;
  newValue?: JsonValue;
  metadata?: JsonValue;
};

export async function createAgentAuditLog(input: CreateAgentAuditLogInput) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("agent_audit_logs").insert({
    actor_agent_id: input.actorAgentId,
    actor_role: input.actorRole,
    action: input.action,
    conversation_id: input.conversationId ?? null,
    customer_id: input.customerId ?? null,
    target_agent_id: input.targetAgentId ?? null,
    message_id: input.messageId ?? null,
    internal_note_id: input.internalNoteId ?? null,
    tag_id: input.tagId ?? null,
    old_value: input.oldValue ?? null,
    new_value: input.newValue ?? null,
    metadata: input.metadata ?? {}
  });

  if (error) {
    throw new Error(error.message);
  }
}

type AgentAuditLogRow = Omit<AgentAuditLog, "agent"> & {
  agents:
    | {
        username: string | null;
        email: string;
      }
    | {
        username: string | null;
        email: string;
      }[]
    | null;
};

function mapAgentAuditLog(row: AgentAuditLogRow): AgentAuditLog {
  const agent = Array.isArray(row.agents) ? row.agents[0] : row.agents;

  return {
    id: row.id,
    created_at: row.created_at,
    actor_agent_id: row.actor_agent_id,
    actor_role: row.actor_role,
    action: row.action,
    conversation_id: row.conversation_id,
    customer_id: row.customer_id,
    target_agent_id: row.target_agent_id,
    message_id: row.message_id,
    internal_note_id: row.internal_note_id,
    tag_id: row.tag_id,
    old_value: row.old_value,
    new_value: row.new_value,
    metadata: row.metadata,
    agent: agent
      ? {
          username: agent.username,
          email: agent.email
        }
      : null
  };
}

export async function listAgentAuditLogs(action: string) {
  const supabase = createSupabaseAdminClient();
  const normalizedAction = action.trim();

  let query = supabase
    .from("agent_audit_logs")
    .select(
      "id, created_at, actor_agent_id, actor_role, action, conversation_id, customer_id, target_agent_id, message_id, internal_note_id, tag_id, old_value, new_value, metadata, agents!agent_audit_logs_actor_agent_id_fkey(username, email)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (normalizedAction) {
    const escaped = normalizedAction.replaceAll("%", "\\%").replaceAll("_", "\\_");
    query = query.ilike("action", `%${escaped}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as AgentAuditLogRow[]).map(mapAgentAuditLog);
}
