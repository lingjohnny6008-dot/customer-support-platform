export type AuthRole = "customer" | "agent" | "admin";

export type SessionUser = {
  id: string;
  role: AuthRole;
  displayName: string;
};

export type LoginResult = {
  id: string;
  display_name: string;
  role: AuthRole;
  status?: string;
  is_active?: boolean;
};

export type CustomerLanguage = "zh" | "en" | "ms";
export type CustomerStatus = "active" | "blocked" | "suspended";

export type ManagedCustomer = {
  id: string;
  created_at: string;
  updated_at: string;
  phone: string;
  internal_name: string;
  full_name: string | null;
  email: string | null;
  country: string | null;
  note_summary: string | null;
  preferred_language: CustomerLanguage;
  status: CustomerStatus;
};

export type CustomerTag = {
  id: string;
  customer_id: string;
  name: string;
  color: string | null;
  created_at: string;
  created_by_agent_id: string | null;
};

export type AgentRole = "admin" | "agent";

export type ManagedAgent = {
  id: string;
  created_at: string;
  updated_at: string;
  username: string | null;
  full_name: string;
  email: string;
  role: AgentRole;
  is_active: boolean;
};

export type MessageSenderType = "customer" | "agent" | "system";

export type ChatMessage = {
  id: string;
  conversation_id: string;
  customer_id: string | null;
  agent_id: string | null;
  sender_type: MessageSenderType;
  type: "text" | "file" | "system";
  body: string | null;
  created_at: string;
  read_at: string | null;
  attachments?: ChatAttachment[];
};

export type ChatAttachment = {
  id: string;
  message_id: string;
  file_url: string;
  file_type: string;
  file_size: number;
};

export type ConversationSummary = {
  id: string;
  customer_id: string;
  assigned_agent_id: string | null;
  status: "open" | "pending" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  last_message_at: string | null;
  created_at: string;
  unread_customer_count: number;
  assigned_agent: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  customer: {
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
};

export type CustomerNote = {
  id: string;
  customer_id: string;
  agent_id: string | null;
  body: string;
  created_at: string;
  author: {
    full_name: string;
    email: string;
  } | null;
};

export type InternalNote = {
  id: string;
  conversation_id: string;
  agent_id: string | null;
  body: string;
  created_at: string;
  author: {
    full_name: string;
    email: string;
  } | null;
};

export type QuickReply = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  content: string;
  is_active: boolean;
};
