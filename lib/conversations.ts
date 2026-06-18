import { createSupabaseAdminClient } from "@/lib/supabase";
import type {
  ChatMessage,
  CustomerNote,
  ConversationSummary,
  CustomerLanguage,
  CustomerStatus,
  InternalNote
} from "@/lib/types";

type ConversationCustomerRow = {
  phone: string;
  internal_name: string;
  full_name: string | null;
  email: string | null;
  country: string | null;
  note_summary: string | null;
  preferred_language: CustomerLanguage;
  status: CustomerStatus;
  created_at: string | null;
  last_seen_at: string | null;
};

type ConversationAgentRow = {
  id: string;
  full_name: string;
  email: string;
};

type ConversationRow = {
  id: string;
  customer_id: string;
  assigned_agent_id: string | null;
  status: ConversationSummary["status"];
  priority: ConversationSummary["priority"];
  last_message_at: string | null;
  created_at: string;
  unread_customer_count?: number;
  customers: ConversationCustomerRow | ConversationCustomerRow[] | null;
  assigned_agent: ConversationAgentRow | ConversationAgentRow[] | null;
};

type CustomerNoteRow = {
  id: string;
  customer_id: string;
  agent_id: string | null;
  body: string;
  created_at: string;
  agents:
    | {
        full_name: string;
        email: string;
      }
    | {
        full_name: string;
        email: string;
      }[]
    | null;
};

type InternalNoteRow = {
  id: string;
  conversation_id: string;
  agent_id: string | null;
  body: string;
  created_at: string;
  agents:
    | {
        full_name: string;
        email: string;
      }
    | {
        full_name: string;
        email: string;
      }[]
    | null;
};

function mapConversation(row: ConversationRow): ConversationSummary {
  const customer = Array.isArray(row.customers)
    ? row.customers[0]
    : row.customers;
  const assignedAgent = Array.isArray(row.assigned_agent)
    ? row.assigned_agent[0]
    : row.assigned_agent;

  return {
    id: row.id,
    customer_id: row.customer_id,
    assigned_agent_id: row.assigned_agent_id,
    status: row.status,
    priority: row.priority,
    last_message_at: row.last_message_at,
    created_at: row.created_at,
    unread_customer_count: row.unread_customer_count ?? 0,
    assigned_agent: assignedAgent
      ? {
          id: assignedAgent.id,
          full_name: assignedAgent.full_name,
          email: assignedAgent.email
        }
      : null,
    customer: {
      phone: customer?.phone ?? "",
      internal_name: customer?.internal_name ?? "",
      full_name: customer?.full_name ?? null,
      email: customer?.email ?? null,
      country: customer?.country ?? null,
      note_summary: customer?.note_summary ?? null,
      preferred_language: customer?.preferred_language ?? "zh",
      status: customer?.status ?? "active",
      created_at: customer?.created_at ?? null,
      last_seen_at: customer?.last_seen_at ?? null
    }
  };
}

function mapCustomerNote(row: CustomerNoteRow): CustomerNote {
  const author = Array.isArray(row.agents) ? row.agents[0] : row.agents;

  return {
    id: row.id,
    customer_id: row.customer_id,
    agent_id: row.agent_id,
    body: row.body,
    created_at: row.created_at,
    author: author
      ? {
          full_name: author.full_name,
          email: author.email
        }
      : null
  };
}

function mapInternalNote(row: InternalNoteRow): InternalNote {
  const author = Array.isArray(row.agents) ? row.agents[0] : row.agents;

  return {
    id: row.id,
    conversation_id: row.conversation_id,
    agent_id: row.agent_id,
    body: row.body,
    created_at: row.created_at,
    author: author
      ? {
          full_name: author.full_name,
          email: author.email
        }
      : null
  };
}

export async function getOrCreateCustomerConversation(customerId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("conversations")
    .select("id")
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .in("status", ["open", "pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.id) {
    return existing.id as string;
  }

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({
      customer_id: customerId,
      status: "open",
      priority: "normal",
      channel: "web"
    })
    .select("id")
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  return created.id as string;
}

export async function updateCustomerLastSeen(customerId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("customers")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", customerId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getCustomerStatus(customerId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .select("status")
    .eq("id", customerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.status as CustomerStatus | undefined;
}

export async function getConversationForCustomer(
  conversationId: string,
  customerId: string
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getConversationForStaff(conversationId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, customer_id, assigned_agent_id, status")
    .eq("id", conversationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function assignConversationToAgent(
  conversationId: string,
  agentId: string | null
) {
  const supabase = createSupabaseAdminClient();

  if (!agentId) {
    const { error } = await supabase
      .from("conversations")
      .update({ assigned_agent_id: null })
      .eq("id", conversationId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id")
    .eq("id", agentId)
    .eq("is_active", true)
    .in("role", ["agent", "admin"])
    .is("deleted_at", null)
    .maybeSingle();

  if (agentError) {
    throw new Error(agentError.message);
  }

  if (!agent) {
    throw new Error("Assigned agent is invalid.");
  }

  const { error } = await supabase
    .from("conversations")
    .update({ assigned_agent_id: agentId })
    .eq("id", conversationId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateConversationStatus(
  conversationId: string,
  status: ConversationSummary["status"]
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("conversations")
    .update({ status })
    .eq("id", conversationId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function listConversationMessages(conversationId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, conversation_id, customer_id, agent_id, sender_type, type, body, created_at, read_at, attachments(id, message_id, file_url, file_type, file_size)"
    )
    .eq("conversation_id", conversationId)
    .in("type", ["text", "file"])
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ChatMessage[];
}

async function countUnreadCustomerMessagesByConversation(
  conversationIds: string[]
) {
  if (conversationIds.length === 0) {
    return new Map<string, number>();
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", conversationIds)
    .eq("sender_type", "customer")
    .in("type", ["text", "file"])
    .is("read_at", null)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reduce((counts, message) => {
    const currentCount = counts.get(message.conversation_id) ?? 0;
    counts.set(message.conversation_id, currentCount + 1);
    return counts;
  }, new Map<string, number>());
}

async function attachUnreadCounts(conversations: ConversationSummary[]) {
  const countsByConversation = await countUnreadCustomerMessagesByConversation(
    conversations.map((conversation) => conversation.id)
  );

  return conversations.map((conversation) => ({
    ...conversation,
    unread_customer_count: countsByConversation.get(conversation.id) ?? 0
  }));
}

export async function listStaffConversations() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, customer_id, assigned_agent_id, status, priority, last_message_at, created_at, customers(phone, internal_name, full_name, email, country, note_summary, preferred_language, status, created_at, last_seen_at), assigned_agent:agents!conversations_assigned_agent_id_fkey(id, full_name, email)"
    )
    .is("deleted_at", null)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  const conversations = ((data ?? []) as unknown as ConversationRow[]).map(
    mapConversation
  );

  return attachUnreadCounts(conversations);
}

export async function getConversationSummary(conversationId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, customer_id, assigned_agent_id, status, priority, last_message_at, created_at, customers(phone, internal_name, full_name, email, country, note_summary, preferred_language, status, created_at, last_seen_at), assigned_agent:agents!conversations_assigned_agent_id_fkey(id, full_name, email)"
    )
    .eq("id", conversationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapConversation(data as unknown as ConversationRow) : null;
}

export async function listCustomerNotes(customerId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("customer_notes")
    .select("id, customer_id, agent_id, body, created_at, agents(full_name, email)")
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as CustomerNoteRow[]).map(mapCustomerNote);
}

export async function listInternalNotes(conversationId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("internal_notes")
    .select(
      "id, conversation_id, agent_id, body, created_at, agents(full_name, email)"
    )
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as InternalNoteRow[]).map(mapInternalNote);
}

export async function markStaffMessagesReadForCustomer(
  conversationId: string,
  _customerId: string
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("sender_type", "agent")
    .in("type", ["text", "file"])
    .is("read_at", null)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markCustomerMessagesReadForStaff(conversationId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("sender_type", "customer")
    .in("type", ["text", "file"])
    .is("read_at", null)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }
}
