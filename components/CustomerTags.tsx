"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  addCustomerTagAction,
  deleteCustomerTagAction,
  type TagActionState
} from "@/app/actions/tags";
import type { CustomerTag } from "@/lib/types";

const initialTagActionState: TagActionState = {};

function TagSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button className="button tag-submit-button" type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </button>
  );
}

function TagActionMessage({ state }: { state: TagActionState }) {
  if (state.error) {
    return <p className="error">{state.error}</p>;
  }

  if (state.success) {
    return <p className="success">{state.success}</p>;
  }

  return null;
}

export function TagBadgeList({
  tags,
  canDelete = false
}: {
  tags: CustomerTag[];
  canDelete?: boolean;
}) {
  if (tags.length === 0) {
    return <p className="empty-state">No tags yet.</p>;
  }

  return (
    <div className="tag-badge-list">
      {tags.map((tag) => (
        <div className="tag-badge-row" key={tag.id}>
          <span
            className="tag-badge"
            style={{ "--tag-color": tag.color ?? "#128c7e" } as CSSProperties}
          >
            {tag.name}
          </span>
          {canDelete ? <DeleteCustomerTagButton tagId={tag.id} /> : null}
        </div>
      ))}
    </div>
  );
}

export function AddCustomerTagForm({
  customerId,
  compact = false
}: {
  customerId: string;
  compact?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(
    addCustomerTagAction,
    initialTagActionState
  );

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form
      ref={formRef}
      className={compact ? "tag-form compact" : "tag-form"}
      action={formAction}
    >
      <input type="hidden" name="customer_id" value={customerId} />
      <input name="name" placeholder="Tag name" maxLength={40} required />
      <input
        aria-label="Tag color"
        name="color"
        type="color"
        defaultValue="#128c7e"
      />
      <TagSubmitButton label="Add tag" />
      <TagActionMessage state={state} />
    </form>
  );
}

function DeleteCustomerTagButton({ tagId }: { tagId: string }) {
  const [state, formAction] = useFormState(
    deleteCustomerTagAction,
    initialTagActionState
  );

  return (
    <form className="tag-delete-form" action={formAction}>
      <input type="hidden" name="tag_id" value={tagId} />
      <button type="submit" aria-label="Delete tag">
        x
      </button>
      <TagActionMessage state={state} />
    </form>
  );
}
