import { createSupabaseAdminClient } from "@/lib/supabase";
import type { AuthRole, LoginResult, SessionUser } from "@/lib/types";

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

export async function authenticateCustomer(formData: FormData) {
  const phone = ensureString(formData.get("phone"));
  const password = ensureString(formData.get("password"));

  if (!phone || !password) {
    throw new Error("Please enter phone and password.");
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("verify_customer_login", {
    input_phone: phone,
    input_password: password
  });

  if (error || !data) {
    throw new Error("Phone or password is incorrect.");
  }

  return toSessionUser(data as LoginResult);
}

export async function authenticateStaff(
  formData: FormData,
  expectedRole: AuthRole
) {
  const identifier = ensureString(formData.get("identifier"));
  const password = ensureString(formData.get("password"));

  if (!identifier || !password) {
    throw new Error("Please enter account and password.");
  }

  const supabase = createSupabaseAdminClient();
  console.log("LOGIN INPUT", {
    identifier,
    expectedRole
  });

  const { data, error } = await supabase.rpc("verify_staff_login", {
    input_identifier: identifier,
    input_password: password,
    expected_role: expectedRole
  });
  console.log("LOGIN RESULT", {
    data,
    error
  });

  if (error || !data) {
    throw new Error("Account or password is incorrect.");
  }

  return toSessionUser(data as LoginResult);
}

export function canAccessDashboard(role: AuthRole) {
  return role === "customer" || role === "agent" || role === "admin";
}

export function canManageCustomers(role: AuthRole) {
  return role === "admin";
}
