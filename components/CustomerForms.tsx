"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  createCustomerAction,
  resetCustomerPasswordAction,
  updateCustomerAction,
  type CustomerActionState
} from "@/app/actions/customers";
import {
  customerLanguages,
  customerStatuses
} from "@/lib/customer-options";
import type { ManagedCustomer } from "@/lib/types";

const initialCustomerActionState: CustomerActionState = {};

function ActionMessage({ state }: { state: CustomerActionState }) {
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

export function CreateCustomerForm() {
  const [state, formAction] = useFormState(
    createCustomerAction,
    initialCustomerActionState
  );

  return (
    <form className="admin-form" action={formAction}>
      <label className="field">
        <span>Phone</span>
        <input name="phone" type="tel" required />
      </label>
      <label className="field">
        <span>Initial password</span>
        <input name="password" type="password" minLength={8} required />
      </label>
      <label className="field">
        <span>Internal name</span>
        <input name="internal_name" type="text" required />
      </label>
      <label className="field">
        <span>Preferred language</span>
        <select name="preferred_language" defaultValue="zh">
          {customerLanguages.map((language) => (
            <option key={language} value={language}>
              {language}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Status</span>
        <select name="status" defaultValue="active">
          {customerStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <SubmitButton label="Create customer" />
      <ActionMessage state={state} />
    </form>
  );
}

export function EditCustomerForm({ customer }: { customer: ManagedCustomer }) {
  const [state, formAction] = useFormState(
    updateCustomerAction,
    initialCustomerActionState
  );

  return (
    <form className="customer-row-form" action={formAction}>
      <input type="hidden" name="customer_id" value={customer.id} />
      <input aria-label="Phone" name="phone" defaultValue={customer.phone} />
      <input
        aria-label="Internal name"
        name="internal_name"
        defaultValue={customer.internal_name}
      />
      <select
        aria-label="Preferred language"
        name="preferred_language"
        defaultValue={customer.preferred_language}
      >
        {customerLanguages.map((language) => (
          <option key={language} value={language}>
            {language}
          </option>
        ))}
      </select>
      <select aria-label="Status" name="status" defaultValue={customer.status}>
        {customerStatuses.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <SubmitButton label="Update" />
      <ActionMessage state={state} />
    </form>
  );
}

export function ResetCustomerPasswordForm({
  customerId
}: {
  customerId: string;
}) {
  const [state, formAction] = useFormState(
    resetCustomerPasswordAction,
    initialCustomerActionState
  );

  return (
    <form className="reset-form" action={formAction}>
      <input type="hidden" name="customer_id" value={customerId} />
      <input
        aria-label="New password"
        name="password"
        type="password"
        minLength={8}
        placeholder="New password"
        required
      />
      <SubmitButton label="Reset" />
      <ActionMessage state={state} />
    </form>
  );
}
