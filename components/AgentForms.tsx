"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  createAgentAction,
  deactivateAgentAction,
  resetAgentPasswordAction,
  updateAgentAction,
  type AgentActionState
} from "@/app/actions/agents";
import { agentRoles } from "@/lib/agents";
import type { ManagedAgent } from "@/lib/types";

const initialAgentActionState: AgentActionState = {};

function AgentActionMessage({ state }: { state: AgentActionState }) {
  if (state.error) {
    return <p className="error">{state.error}</p>;
  }

  if (state.success) {
    return <p className="success">{state.success}</p>;
  }

  return null;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button className="button" type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </button>
  );
}

export function CreateAgentForm() {
  const [state, formAction] = useFormState(
    createAgentAction,
    initialAgentActionState
  );

  return (
    <form className="agent-create-form" action={formAction}>
      <label className="field">
        <span>Username</span>
        <input name="username" required />
      </label>
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" required />
      </label>
      <label className="field">
        <span>Full name</span>
        <input name="full_name" required />
      </label>
      <label className="field">
        <span>Initial password</span>
        <input name="password" type="password" minLength={8} required />
      </label>
      <label className="field">
        <span>Role</span>
        <select name="role" defaultValue="agent">
          {agentRoles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>
      <label className="check-field">
        <input name="is_active" type="checkbox" defaultChecked />
        <span>Active</span>
      </label>
      <SubmitButton label="Create agent" />
      <AgentActionMessage state={state} />
    </form>
  );
}

export function EditAgentForm({ agent }: { agent: ManagedAgent }) {
  const [state, formAction] = useFormState(
    updateAgentAction,
    initialAgentActionState
  );

  return (
    <form className="agent-row-form" action={formAction}>
      <input type="hidden" name="agent_id" value={agent.id} />
      <input
        aria-label="Username"
        name="username"
        defaultValue={agent.username ?? ""}
        required
      />
      <input aria-label="Email" name="email" defaultValue={agent.email} required />
      <input
        aria-label="Full name"
        name="full_name"
        defaultValue={agent.full_name}
        required
      />
      <select aria-label="Role" name="role" defaultValue={agent.role}>
        {agentRoles.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
      <label className="table-check-field">
        <input name="is_active" type="checkbox" defaultChecked={agent.is_active} />
        <span>Active</span>
      </label>
      <SubmitButton label="Update" />
      <AgentActionMessage state={state} />
    </form>
  );
}

export function AgentPasswordForm({ agentId }: { agentId: string }) {
  const [state, formAction] = useFormState(
    resetAgentPasswordAction,
    initialAgentActionState
  );

  return (
    <form className="agent-secondary-form" action={formAction}>
      <input type="hidden" name="agent_id" value={agentId} />
      <input
        aria-label="New password"
        name="password"
        type="password"
        minLength={8}
        placeholder="New password"
        required
      />
      <SubmitButton label="Reset password" />
      <AgentActionMessage state={state} />
    </form>
  );
}

export function DeactivateAgentForm({ agentId }: { agentId: string }) {
  const [state, formAction] = useFormState(
    deactivateAgentAction,
    initialAgentActionState
  );

  return (
    <form className="agent-secondary-form" action={formAction}>
      <input type="hidden" name="agent_id" value={agentId} />
      <button className="button button-secondary" type="submit">
        Deactivate
      </button>
      <AgentActionMessage state={state} />
    </form>
  );
}
