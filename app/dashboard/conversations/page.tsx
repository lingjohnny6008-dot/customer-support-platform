import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createInternalNoteAction,
  sendAgentMessageAction
} from "@/app/actions/conversations";
import {
  ConversationSearchInput,
  ConversationSearchProvider
} from "@/components/ConversationSearch";
import { ConversationSidebarList } from "@/components/ConversationSidebarList";
import { CustomerNotesForm } from "@/components/CustomerNotesForm";
import { CustomerNotesList } from "@/components/CustomerNotesList";
import { AddCustomerTagForm, TagBadgeList } from "@/components/CustomerTags";
import { ConversationThread } from "@/components/ConversationThread";
import { ConversationAssignmentForm } from "@/components/ConversationAssignmentForm";
import { ConversationStatusForm } from "@/components/ConversationStatusForm";
import {
  getConversationSummary,
  listCustomerNotes,
  listConversationMessages,
  listInternalNotes,
  listStaffConversations,
  markCustomerMessagesReadForStaff
} from "@/lib/conversations";
import { getCurrentSession } from "@/lib/session";
import { listActiveQuickReplies } from "@/lib/quick-replies";
import { getSupabasePublicConfig } from "@/lib/supabase";
import { listCustomerTags } from "@/lib/tags";
import { listTagsForCustomers } from "@/lib/tags";
import { listAssignableAgents } from "@/lib/agents";
import {
  filterConversations,
  getConversationFilter,
  getConversationFilterCounts
} from "@/lib/conversation-filters";
import type {
  ConversationSummary,
  CustomerNote,
  CustomerTag,
  ManagedAgent
} from "@/lib/types";

type ConversationsPageProps = {
  searchParams?: {
    conversationId?: string;
    filter?: string;
  };
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "No activity yet";
  }

  return new Date(value).toLocaleString();
}

function CustomerProfileCard({
  conversation,
  tags,
  assignableAgents
}: {
  conversation: ConversationSummary;
  tags: CustomerTag[];
  assignableAgents: ManagedAgent[];
}) {
  return (
    <section className="profile-card">
      <header className="profile-card-header">
        <span>Customer</span>
        <h2>{conversation.customer.internal_name}</h2>
        <p>{conversation.customer.phone}</p>
      </header>

      <dl className="profile-detail-list">
        <div>
          <dt>Internal name</dt>
          <dd>{conversation.customer.internal_name}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{conversation.customer.phone}</dd>
        </div>
        <div>
          <dt>Full name</dt>
          <dd>{conversation.customer.full_name ?? "Not set"}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{conversation.customer.email ?? "Not set"}</dd>
        </div>
        <div>
          <dt>Country</dt>
          <dd>{conversation.customer.country ?? "Not set"}</dd>
        </div>
        <div>
          <dt>Preferred language</dt>
          <dd>{conversation.customer.preferred_language}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className={`status-pill ${conversation.customer.status}`}>
              {conversation.customer.status}
            </span>
          </dd>
        </div>
        <div>
          <dt>Assigned Agent</dt>
          <dd>
            <span>{conversation.assigned_agent?.full_name ?? "Unassigned"}</span>
            <ConversationAssignmentForm
              conversationId={conversation.id}
              assignedAgentId={conversation.assigned_agent_id}
              agents={assignableAgents}
            />
          </dd>
        </div>
        <div>
          <dt>Conversation</dt>
          <dd>
            <span className={`conversation-status-pill ${conversation.status}`}>
              {conversation.status === "closed" ? "Closed" : "Open"}
            </span>
          </dd>
        </div>
        <div>
          <dt>Created at</dt>
          <dd>{formatDateTime(conversation.customer.created_at)}</dd>
        </div>
        <div>
          <dt>Last activity</dt>
          <dd>{formatDateTime(conversation.last_message_at)}</dd>
        </div>
        <div>
          <dt>Last Seen</dt>
          <dd>{formatDateTime(conversation.customer.last_seen_at)}</dd>
        </div>
        <div>
          <dt>Note summary</dt>
          <dd>{conversation.customer.note_summary ?? "Not set"}</dd>
        </div>
      </dl>

      <section className="profile-assignment-section">
        <h3>Conversation Status</h3>
        <ConversationStatusForm
          conversationId={conversation.id}
          status={conversation.status}
        />
      </section>

      <section className="profile-tags-section">
        <div className="profile-tags-header">
          <h3>Tags</h3>
          <span>{tags.length}</span>
        </div>
        <TagBadgeList tags={tags} />
        <AddCustomerTagForm customerId={conversation.customer_id} compact />
      </section>
    </section>
  );
}

function CustomerNotesCard({
  customerId,
  notes
}: {
  customerId: string;
  notes: CustomerNote[];
}) {
  return (
    <section className="customer-notes-card">
      <header className="notes-card-header">
        <h2>Customer Notes</h2>
        <span>{notes.length}</span>
      </header>

      <CustomerNotesForm customerId={customerId} />

      <CustomerNotesList notes={notes} />
    </section>
  );
}

export default async function StaffConversationsPage({
  searchParams
}: ConversationsPageProps) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/staff-login");
  }

  if (session.role !== "agent" && session.role !== "admin") {
    redirect("/dashboard");
  }

  let allConversations = await listStaffConversations();
  const activeFilter = getConversationFilter(searchParams?.filter);
  const initialNow = Date.now();
  let tagsByCustomer = await listTagsForCustomers(
    allConversations.map((conversation) => conversation.customer_id)
  );
  let filterCounts = getConversationFilterCounts({
    conversations: allConversations,
    currentAgentId: session.id,
    tagsByCustomer,
    now: initialNow
  });
  let conversations = filterConversations({
    conversations: allConversations,
    filter: activeFilter,
    currentAgentId: session.id,
    tagsByCustomer,
    now: initialNow
  });
  const selectedConversationId =
    conversations.some(
      (conversation) => conversation.id === searchParams?.conversationId
    )
      ? searchParams?.conversationId ?? null
      : conversations[0]?.id ?? null;
  if (selectedConversationId) {
    await markCustomerMessagesReadForStaff(selectedConversationId);
    allConversations = await listStaffConversations();
    tagsByCustomer = await listTagsForCustomers(
      allConversations.map((conversation) => conversation.customer_id)
    );
    filterCounts = getConversationFilterCounts({
      conversations: allConversations,
      currentAgentId: session.id,
      tagsByCustomer,
      now: initialNow
    });
    conversations = filterConversations({
      conversations: allConversations,
      filter: activeFilter,
      currentAgentId: session.id,
      tagsByCustomer,
      now: initialNow
    });
  }
  const selectedConversation = selectedConversationId
    ? await getConversationSummary(selectedConversationId)
    : null;
  const messages = selectedConversationId
    ? await listConversationMessages(selectedConversationId)
    : [];
  const internalNotes = selectedConversationId
    ? await listInternalNotes(selectedConversationId)
    : [];
  const customerNotes = selectedConversation
    ? await listCustomerNotes(selectedConversation.customer_id)
    : [];
  const customerTags = selectedConversation
    ? await listCustomerTags(selectedConversation.customer_id)
    : [];
  const quickReplies =
    session.role === "agent" || session.role === "admin"
      ? await listActiveQuickReplies()
      : [];
  const assignableAgents = await listAssignableAgents();
  const { supabaseUrl, anonKey } = getSupabasePublicConfig();

  return (
    <main className="staff-chat-shell">
      <aside className="conversation-sidebar">
        <div className="sidebar-header">
          <h1 className="title">Conversations</h1>
          <Link href="/dashboard">Dashboard</Link>
        </div>

        <ConversationSidebarList
          conversations={conversations}
          filterCounts={filterCounts}
          activeFilter={activeFilter}
          selectedConversationId={selectedConversationId}
          initialNow={initialNow}
        />
      </aside>

      <ConversationSearchProvider>
        <section className="staff-conversation-panel">
          {selectedConversation && selectedConversationId ? (
            <>
              <header className="chat-header compact">
                <div>
                  <h2>{selectedConversation.customer.internal_name}</h2>
                  <p>{selectedConversation.customer.phone}</p>
                </div>
                <ConversationSearchInput />
              </header>
              <ConversationThread
                conversationId={selectedConversationId}
                initialMessages={messages}
                initialInternalNotes={internalNotes}
                currentUserRole={session.role}
                currentUserId={session.id}
                conversationStatus={selectedConversation.status}
                supabaseUrl={supabaseUrl}
                supabaseAnonKey={anonKey}
                enableEnterToSend
                quickReplies={quickReplies}
                action={sendAgentMessageAction}
                internalNoteAction={createInternalNoteAction}
              />
            </>
          ) : (
            <p className="empty-state">Select a conversation to start replying.</p>
          )}
        </section>

        {selectedConversation ? (
          <aside className="customer-profile-panel">
            <CustomerProfileCard
              conversation={selectedConversation}
              tags={customerTags}
              assignableAgents={assignableAgents}
            />
            <CustomerNotesCard
              customerId={selectedConversation.customer_id}
              notes={customerNotes}
            />
          </aside>
        ) : null}
      </ConversationSearchProvider>
    </main>
  );
}
