"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  assignConversationAction,
  type AssignmentActionState
} from "@/app/actions/conversations";
import type { ManagedAgent } from "@/lib/types";

const initialAssignmentState: AssignmentActionState = {};

function AssignmentSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button assignment-submit-button" type="submit" disabled={pending}>
      {pending ? "Assigning..." : "Assign"}
    </button>
  );
}

export function ConversationAssignmentForm({
  conversationId,
  assignedAgentId,
  agents
}: {
  conversationId: string;
  assignedAgentId: string | null;
  agents: ManagedAgent[];
}) {
  const [state, formAction] = useFormState(
    assignConversationAction,
    initialAssignmentState
  );

  return (
    <form className="assignment-form" action={formAction}>
      <input type="hidden" name="conversation_id" value={conversationId} />
      <select
        aria-label="Assigned agent"
        name="agent_id"
        defaultValue={assignedAgentId ?? ""}
        required
      >
        <option value="" disabled>
          Select agent
        </option>
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.full_name}
          </option>
        ))}
      </select>
      <AssignmentSubmitButton />
      {state.error ? <p className="error">{state.error}</p> : null}
      {state.success ? <p className="success">{state.success}</p> : null}
    </form>
  );
}
