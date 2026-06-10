"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { LoginActionState } from "@/app/actions/auth";

type LoginFormProps = {
  mode: "customer" | "staff";
  action: (
    previousState: LoginActionState,
    formData: FormData
  ) => Promise<LoginActionState>;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button" type="submit" disabled={pending}>
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}

export function LoginForm({ mode, action }: LoginFormProps) {
  const [state, formAction] = useFormState(action, {});
  const isCustomer = mode === "customer";

  return (
    <form className="form" action={formAction}>
      {isCustomer ? (
        <label className="field">
          <span>Phone</span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            required
          />
        </label>
      ) : (
        <>
          <label className="field">
            <span>Login as</span>
            <select name="role" defaultValue="agent">
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="field">
            <span>Username or email</span>
            <input
              name="identifier"
              type="text"
              autoComplete="username"
              required
            />
          </label>
        </>
      )}

      <label className="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete={isCustomer ? "current-password" : "current-password"}
          required
        />
      </label>

      {state.error ? <p className="error">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
