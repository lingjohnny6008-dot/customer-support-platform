import { redirect } from "next/navigation";
import { sendCustomerMessageAction } from "@/app/actions/conversations";
import { ConversationThread } from "@/components/ConversationThread";
import {
  getOrCreateCustomerConversation,
  listConversationMessages,
  markStaffMessagesReadForCustomer
} from "@/lib/conversations";
import { getCurrentSession } from "@/lib/session";
import { getSupabasePublicConfig } from "@/lib/supabase";

export default async function CustomerChatPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login/customer");
  }

  if (session.role !== "customer") {
    redirect("/dashboard");
  }

  const conversationId = await getOrCreateCustomerConversation(session.id);
  await markStaffMessagesReadForCustomer(conversationId, session.id);
  const messages = await listConversationMessages(conversationId);
  const { supabaseUrl, anonKey } = getSupabasePublicConfig();

  return (
    <main className="chat-shell">
      <header className="chat-header">
        <div>
          <h1 className="title">Support Chat</h1>
          <p className="subtitle">Text support conversation</p>
        </div>
      </header>

      <ConversationThread
        conversationId={conversationId}
        initialMessages={messages}
        currentUserRole={session.role}
        currentUserId={session.id}
        supabaseUrl={supabaseUrl}
        supabaseAnonKey={anonKey}
        action={sendCustomerMessageAction}
      />
    </main>
  );
}
