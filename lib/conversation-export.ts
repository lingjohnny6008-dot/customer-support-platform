import { createSupabaseAdminClient } from "@/lib/supabase";
import type { ChatMessage, InternalNote } from "@/lib/types";

type ExportConversationCustomerRow = {
  phone: string;
  internal_name: string;
  status: string;
};

type ExportConversationAgentRow = {
  username: string | null;
  email: string;
};

type ExportConversationRow = {
  id: string;
  status: string;
  assigned_agent_id: string | null;
  customers: ExportConversationCustomerRow | ExportConversationCustomerRow[] | null;
  assigned_agent:
    | ExportConversationAgentRow
    | ExportConversationAgentRow[]
    | null;
};

export type ConversationExportData = {
  conversation: {
    id: string;
    status: string;
    customer: ExportConversationCustomerRow;
    assignedAgent: ExportConversationAgentRow | null;
  };
  messages: ChatMessage[];
  internalNotes: InternalNote[];
};

function normalizeOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatDateTime(value: string) {
  return new Date(value).toISOString();
}

function formatAttachment(message: ChatMessage) {
  const attachments = message.attachments ?? [];

  if (attachments.length === 0) {
    return message.type === "file" && message.body
      ? `Attachment: ${message.body}`
      : null;
  }

  return attachments
    .map((attachment, index) => {
      const filename = attachment.file_url.split("/").pop() ?? attachment.file_url;
      return [
        `Attachment ${index + 1}:`,
        `URL=${attachment.file_url}`,
        `Filename=${filename}`,
        `Type=${attachment.file_type}`,
        `Size=${attachment.file_size}`
      ].join(" ");
    })
    .join("\n");
}

function formatMessage(message: ChatMessage) {
  const sender =
    message.sender_type === "customer"
      ? "Customer"
      : message.sender_type === "agent"
        ? "Agent"
        : "System";
  const lines = [
    `[${formatDateTime(message.created_at)}] ${sender}`,
    `Message ID: ${message.id}`,
    `Type: ${message.type}`
  ];
  const body = message.body?.trim();
  const attachmentText = formatAttachment(message);

  if (body && message.type !== "file") {
    lines.push(`Body: ${body}`);
  }

  if (attachmentText) {
    lines.push(attachmentText);
  }

  return lines.join("\n");
}

function formatInternalNote(note: InternalNote) {
  const author = note.author
    ? `${note.author.full_name} / ${note.author.email}`
    : "Unknown agent";

  return [
    `[${formatDateTime(note.created_at)}] ${author}`,
    `Internal Note ID: ${note.id}`,
    `Body: ${note.body}`
  ].join("\n");
}

export async function getConversationExportData(
  conversationId: string
): Promise<ConversationExportData | null> {
  const supabase = createSupabaseAdminClient();
  const { data: conversationRow, error: conversationError } = await supabase
    .from("conversations")
    .select(
      "id, status, assigned_agent_id, customers(phone, internal_name, status), assigned_agent:agents!conversations_assigned_agent_id_fkey(username, email)"
    )
    .eq("id", conversationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (conversationError) {
    throw new Error(conversationError.message);
  }

  if (!conversationRow) {
    return null;
  }

  const row = conversationRow as unknown as ExportConversationRow;
  const customer = normalizeOne(row.customers);
  const assignedAgent = normalizeOne(row.assigned_agent);

  if (!customer) {
    throw new Error("Conversation customer not found.");
  }

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select(
      "id, conversation_id, customer_id, agent_id, sender_type, type, body, created_at, read_at, attachments(id, message_id, file_url, file_type, file_size)"
    )
    .eq("conversation_id", conversationId)
    .in("type", ["text", "file"])
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  const { data: internalNotes, error: internalNotesError } = await supabase
    .from("internal_notes")
    .select(
      "id, conversation_id, agent_id, body, created_at, agents(full_name, email)"
    )
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (internalNotesError) {
    throw new Error(internalNotesError.message);
  }

  return {
    conversation: {
      id: row.id,
      status: row.status,
      customer,
      assignedAgent
    },
    messages: (messages ?? []) as ChatMessage[],
    internalNotes: ((internalNotes ?? []) as unknown as Array<
      Omit<InternalNote, "author"> & {
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
      }
    >).map((note) => {
      const author = normalizeOne(note.agents);

      return {
        id: note.id,
        conversation_id: note.conversation_id,
        agent_id: note.agent_id,
        body: note.body,
        created_at: note.created_at,
        author: author
          ? {
              full_name: author.full_name,
              email: author.email
            }
          : null
      };
    })
  };
}

export function buildConversationTxtExport(data: ConversationExportData) {
  const assignedAgent = data.conversation.assignedAgent
    ? `${data.conversation.assignedAgent.username ?? "No username"} / ${
        data.conversation.assignedAgent.email
      }`
    : "Unassigned";
  const lines = [
    "Support Chat Platform - Conversation Export",
    "",
    `Exported At: ${new Date().toISOString()}`,
    `Conversation ID: ${data.conversation.id}`,
    `Conversation Status: ${data.conversation.status}`,
    `Customer phone: ${data.conversation.customer.phone}`,
    `Customer internal_name: ${data.conversation.customer.internal_name}`,
    `Customer status: ${data.conversation.customer.status}`,
    `Assigned agent username/email: ${assignedAgent}`,
    "",
    "Messages timeline",
    "================="
  ];

  if (data.messages.length === 0) {
    lines.push("No messages.");
  } else {
    lines.push(...data.messages.map(formatMessage).join("\n\n").split("\n"));
  }

  lines.push("", "Internal notes", "==============");

  if (data.internalNotes.length === 0) {
    lines.push("No internal notes.");
  } else {
    lines.push(
      ...data.internalNotes.map(formatInternalNote).join("\n\n").split("\n")
    );
  }

  return `${lines.join("\n")}\n`;
}
