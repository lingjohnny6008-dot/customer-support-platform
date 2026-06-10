"use client";

import Link from "next/link";
import { useState } from "react";
import type { ConversationSummary } from "@/lib/types";

export function ConversationSidebarList({
  conversations,
  selectedConversationId
}: {
  conversations: ConversationSummary[];
  selectedConversationId: string | null;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredConversations = normalizedQuery
    ? conversations.filter((conversation) => {
        const name = conversation.customer.internal_name.toLowerCase();
        const phone = conversation.customer.phone.toLowerCase();
        return name.includes(normalizedQuery) || phone.includes(normalizedQuery);
      })
    : conversations;

  return (
    <>
      <label className="sidebar-search-field">
        <span>Search customers</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Internal name or phone"
        />
      </label>

      {filteredConversations.length === 0 ? (
        <p className="empty-state">No conversations found.</p>
      ) : (
        <nav className="conversation-list">
          {filteredConversations.map((conversation) => (
            <Link
              className={
                conversation.id === selectedConversationId
                  ? "conversation-link active"
                  : "conversation-link"
              }
              href={`/dashboard/conversations?conversationId=${conversation.id}`}
              key={conversation.id}
            >
              <strong>
                {conversation.customer.internal_name}
                {conversation.unread_customer_count > 0 ? (
                  <span className="unread-count-badge">
                    {conversation.unread_customer_count}
                  </span>
                ) : null}
              </strong>
              <span>{conversation.customer.phone}</span>
              <small>
                {conversation.last_message_at
                  ? new Date(conversation.last_message_at).toLocaleString()
                  : "No messages"}
              </small>
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
