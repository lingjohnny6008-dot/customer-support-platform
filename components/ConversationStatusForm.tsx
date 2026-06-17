"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  updateConversationStatusAction,
  type ConversationStatusActionState
} from "@/app/actions/conversations";

const initialStatusState: ConversationStatusActionState = {};

function StatusSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button className="button conversation-status-button" type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </button>
  );
}

export function ConversationStatusForm({
  conversationId,
  status
}: {
  conversationId: string;
  status: "open" | "pending" | "resolved" | "closed";
}) {
  const [state, formAction] = useFormState(
    updateConversationStatusAction,
    initialStatusState
  );
  const isClosed = status === "closed";
  const nextStatus = isClosed ? "open" : "closed";

  return (
    <form className="conversation-status-form" action={formAction}>
      <input type="hidden" name="conversation_id" value={conversationId} />
      <input type="hidden" name="status" value={nextStatus} />
      <StatusSubmitButton
        label={isClosed ? "Reopen Conversation" : "Close Conversation"}
      />
      {state.error ? <p className="error">{state.error}</p> : null}
      {state.success ? <p className="success">{state.success}</p> : null}
    </form>
  );
}
