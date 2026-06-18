import type { ConversationSummary, CustomerTag } from "@/lib/types";

export type ConversationFilterKey =
  | "all"
  | "my"
  | "unassigned"
  | "unread"
  | "online"
  | "vip"
  | "closed";

export type ConversationFilter = {
  key: ConversationFilterKey;
  label: string;
};

export type ConversationFilterCount = ConversationFilter & {
  count: number;
};

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export const conversationFilters: ConversationFilter[] = [
  { key: "all", label: "All" },
  { key: "my", label: "My Conversations" },
  { key: "unassigned", label: "Unassigned" },
  { key: "unread", label: "Unread" },
  { key: "online", label: "Online" },
  { key: "vip", label: "VIP" },
  { key: "closed", label: "Closed" }
];

export function getConversationFilter(value: string | undefined) {
  return conversationFilters.some((filter) => filter.key === value)
    ? (value as ConversationFilterKey)
    : "all";
}

export function isCustomerOnline(lastSeenAt: string | null, now: number) {
  return lastSeenAt
    ? now - new Date(lastSeenAt).getTime() <= ONLINE_WINDOW_MS
    : false;
}

function customerHasVipTag(
  conversation: ConversationSummary,
  tagsByCustomer: Map<string, CustomerTag[]>
) {
  return (tagsByCustomer.get(conversation.customer_id) ?? []).some(
    (tag) => tag.name.trim().toLowerCase() === "vip"
  );
}

function matchesConversationFilter({
  conversation,
  filter,
  currentAgentId,
  tagsByCustomer,
  now
}: {
  conversation: ConversationSummary;
  filter: ConversationFilterKey;
  currentAgentId: string;
  tagsByCustomer: Map<string, CustomerTag[]>;
  now: number;
}) {
  if (filter === "my") {
    return conversation.assigned_agent_id === currentAgentId;
  }

  if (filter === "unassigned") {
    return !conversation.assigned_agent_id;
  }

  if (filter === "unread") {
    return conversation.unread_customer_count > 0;
  }

  if (filter === "online") {
    return isCustomerOnline(conversation.customer.last_seen_at, now);
  }

  if (filter === "vip") {
    return customerHasVipTag(conversation, tagsByCustomer);
  }

  if (filter === "closed") {
    return conversation.status === "closed";
  }

  return true;
}

export function filterConversations({
  conversations,
  filter,
  currentAgentId,
  tagsByCustomer,
  now
}: {
  conversations: ConversationSummary[];
  filter: ConversationFilterKey;
  currentAgentId: string;
  tagsByCustomer: Map<string, CustomerTag[]>;
  now: number;
}) {
  return conversations.filter((conversation) =>
    matchesConversationFilter({
      conversation,
      filter,
      currentAgentId,
      tagsByCustomer,
      now
    })
  );
}

export function getConversationFilterCounts({
  conversations,
  currentAgentId,
  tagsByCustomer,
  now
}: {
  conversations: ConversationSummary[];
  currentAgentId: string;
  tagsByCustomer: Map<string, CustomerTag[]>;
  now: number;
}): ConversationFilterCount[] {
  return conversationFilters.map((filter) => ({
    ...filter,
    count: filterConversations({
      conversations,
      filter: filter.key,
      currentAgentId,
      tagsByCustomer,
      now
    }).length
  }));
}
