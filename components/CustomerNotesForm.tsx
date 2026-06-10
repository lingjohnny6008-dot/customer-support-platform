"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createCustomerNoteAction,
  type CustomerNoteActionState
} from "@/app/actions/conversations";

const initialCustomerNoteState: CustomerNoteActionState = {};

function NoteSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button note-submit-button" type="submit" disabled={pending}>
      {pending ? "Saving..." : "Add note"}
    </button>
  );
}

export function CustomerNotesForm({ customerId }: { customerId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(
    createCustomerNoteAction,
    initialCustomerNoteState
  );

  useEffect(() => {
    if (state.successId) {
      formRef.current?.reset();
    }
  }, [state.successId]);

  return (
    <form ref={formRef} className="customer-note-form" action={formAction}>
      <input type="hidden" name="customer_id" value={customerId} />
      <textarea
        name="body"
        placeholder="Add a customer note"
        rows={4}
        maxLength={2000}
        required
      />
      <NoteSubmitButton />
      {state.error ? <p className="error">{state.error}</p> : null}
    </form>
  );
}
