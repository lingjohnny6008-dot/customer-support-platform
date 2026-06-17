"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  createQuickReplyAction,
  deactivateQuickReplyAction,
  updateQuickReplyAction,
  type QuickReplyActionState
} from "@/app/actions/quick-replies";
import type { QuickReply } from "@/lib/types";

const initialQuickReplyState: QuickReplyActionState = {};

function QuickReplyActionMessage({ state }: { state: QuickReplyActionState }) {
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

export function CreateQuickReplyForm() {
  const [state, formAction] = useFormState(
    createQuickReplyAction,
    initialQuickReplyState
  );

  return (
    <form className="quick-reply-create-form" action={formAction}>
      <label className="field">
        <span>Category</span>
        <input name="category" defaultValue="General" maxLength={80} required />
      </label>
      <label className="field">
        <span>Title</span>
        <input name="title" maxLength={100} required />
      </label>
      <label className="field">
        <span>Content</span>
        <textarea name="content" rows={4} maxLength={4000} required />
      </label>
      <label className="check-field">
        <input name="is_active" type="checkbox" defaultChecked />
        <span>Active</span>
      </label>
      <SubmitButton label="Create quick reply" />
      <QuickReplyActionMessage state={state} />
    </form>
  );
}

export function EditQuickReplyForm({
  quickReply
}: {
  quickReply: QuickReply;
}) {
  const [state, formAction] = useFormState(
    updateQuickReplyAction,
    initialQuickReplyState
  );

  return (
    <form className="quick-reply-row-form" action={formAction}>
      <input type="hidden" name="quick_reply_id" value={quickReply.id} />
      <input
        aria-label="Category"
        name="category"
        defaultValue={quickReply.category}
        maxLength={80}
        required
      />
      <input
        aria-label="Title"
        name="title"
        defaultValue={quickReply.title}
        maxLength={100}
        required
      />
      <textarea
        aria-label="Content"
        name="content"
        defaultValue={quickReply.content}
        rows={3}
        maxLength={4000}
        required
      />
      <label className="table-check-field">
        <input
          name="is_active"
          type="checkbox"
          defaultChecked={quickReply.is_active}
        />
        <span>Active</span>
      </label>
      <SubmitButton label="Update" />
      <QuickReplyActionMessage state={state} />
    </form>
  );
}

export function DeactivateQuickReplyForm({
  quickReplyId
}: {
  quickReplyId: string;
}) {
  const [state, formAction] = useFormState(
    deactivateQuickReplyAction,
    initialQuickReplyState
  );

  return (
    <form className="quick-reply-secondary-form" action={formAction}>
      <input type="hidden" name="quick_reply_id" value={quickReplyId} />
      <button className="button button-secondary" type="submit">
        Deactivate
      </button>
      <QuickReplyActionMessage state={state} />
    </form>
  );
}
