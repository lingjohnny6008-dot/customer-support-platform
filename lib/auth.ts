import { createSupabaseAdminClient } from "@/lib/supabase";
import type { AuthRole, LoginResult, SessionUser } from "@/lib/types";
import {
  assertLoginNotLocked,
  createLoginLog,
  normalizeLoginIdentifier,
  TOO_MANY_LOGIN_ATTEMPTS_MESSAGE,
  type LoginRequestContext
} from "@/lib/login-security";

function ensureString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function toSessionUser(result: LoginResult): SessionUser {
  return {
    id: result.id,
    role: result.role,
    displayName: result.display_name
  };
}

type LoginFailureResult = {
  failure_reason?: string;
  customer_id?: string;
  agent_id?: string;
};

function getFailureReason(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "failure_reason" in data) {
    const reason = (data as LoginFailureResult).failure_reason;
    return typeof reason === "string" ? reason : fallback;
  }

  return fallback;
}

function getFailureActorIds(data: unknown) {
  if (!data || typeof data !== "object") {
    return {};
  }

  const result = data as LoginFailureResult;

  return {
    customerId:
      typeof result.customer_id === "string" ? result.customer_id : null,
    agentId: typeof result.agent_id === "string" ? result.agent_id : null
  };
}

function isSuccessfulLoginResult(data: unknown): data is LoginResult {
  return Boolean(
    data &&
      typeof data === "object" &&
      "id" in data &&
      "role" in data &&
      "display_name" in data
  );
}

export async function authenticateCustomerWithSecurity(
  formData: FormData,
  context: LoginRequestContext
) {
  const phone = ensureString(formData.get("phone"));
  const password = ensureString(formData.get("password"));
  const identifier = normalizeLoginIdentifier(phone);

  if (!phone || !password) {
    await createLoginLog({
      actorType: "customer",
      identifier: identifier || "unknown",
      result: "failed",
      failureReason: "missing_credentials",
      ...context
    });

    throw new Error("Please enter phone and password.");
  }

  try {
    await assertLoginNotLocked("customer", identifier);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === TOO_MANY_LOGIN_ATTEMPTS_MESSAGE
    ) {
      await createLoginLog({
        actorType: "customer",
        identifier,
        result: "failed",
        failureReason: "too_many_attempts",
        ...context
      });
    }

    throw error;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("verify_customer_login", {
    input_phone: phone,
    input_password: password
  });

  if (error || !isSuccessfulLoginResult(data)) {
    const { customerId } = getFailureActorIds(data);
    await createLoginLog({
      actorType: "customer",
      identifier,
      result: "failed",
      failureReason: error
        ? "login_error"
        : getFailureReason(data, "invalid_credentials"),
      customerId,
      ...context
    });

    throw new Error(
      getFailureReason(data, "Phone or password is incorrect.") ===
        "customer_blocked"
        ? "Account is blocked."
        : "Phone or password is incorrect."
    );
  }

  await createLoginLog({
    actorType: "customer",
    identifier,
    result: "success",
    customerId: data.id,
    ...context
  });

  return toSessionUser(data);
}

export async function authenticateStaffWithSecurity(
  formData: FormData,
  expectedRole: AuthRole,
  context: LoginRequestContext
) {
  const identifierInput = ensureString(formData.get("identifier"));
  const password = ensureString(formData.get("password"));
  const identifier = normalizeLoginIdentifier(identifierInput);

  if (!identifierInput || !password) {
    await createLoginLog({
      actorType: "agent",
      identifier: identifier || "unknown",
      result: "failed",
      failureReason: "missing_credentials",
      ...context
    });

    throw new Error("Please enter account and password.");
  }

  try {
    await assertLoginNotLocked("agent", identifier);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === TOO_MANY_LOGIN_ATTEMPTS_MESSAGE
    ) {
      await createLoginLog({
        actorType: "agent",
        identifier,
        result: "failed",
        failureReason: "too_many_attempts",
        ...context
      });
    }

    throw error;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("verify_staff_login", {
    input_identifier: identifierInput,
    input_password: password,
    expected_role: expectedRole
  });

  if (error || !isSuccessfulLoginResult(data)) {
    const { agentId } = getFailureActorIds(data);
    await createLoginLog({
      actorType: "agent",
      identifier,
      result: "failed",
      failureReason: error
        ? "login_error"
        : getFailureReason(data, "invalid_credentials"),
      agentId,
      ...context
    });

    throw new Error("Account or password is incorrect.");
  }

  await createLoginLog({
    actorType: "agent",
    identifier,
    result: "success",
    agentId: data.id,
    ...context
  });

  return toSessionUser(data);
}

export function canAccessDashboard(role: AuthRole) {
  return role === "customer" || role === "agent" || role === "admin";
}

export function canManageCustomers(role: AuthRole) {
  return role === "admin";
}
