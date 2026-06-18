"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAgentAuditLog } from "@/lib/audit-logs";
import { canManageCustomers } from "@/lib/auth";
import { isCustomerLanguage, isCustomerStatus } from "@/lib/customer-options";
import { getCurrentSession } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type CustomerActionState = {
  error?: string;
  success?: string;
};

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function requireAdmin() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/staff-login");
  }

  if (!canManageCustomers(session.role)) {
    redirect("/dashboard");
  }

  return session;
}

function readCustomerFields(formData: FormData) {
  const phone = readText(formData, "phone");
  const internalName = readText(formData, "internal_name");
  const fullName = readText(formData, "full_name");
  const email = readText(formData, "email");
  const country = readText(formData, "country");
  const noteSummary = readText(formData, "note_summary");
  const preferredLanguage = readText(formData, "preferred_language");
  const status = readText(formData, "status");

  if (!phone) {
    throw new Error("Phone is required.");
  }

  if (!internalName) {
    throw new Error("Internal name is required.");
  }

  if (!isCustomerLanguage(preferredLanguage)) {
    throw new Error("Preferred language is invalid.");
  }

  if (!isCustomerStatus(status)) {
    throw new Error("Status is invalid.");
  }

  return {
    phone,
    internalName,
    fullName,
    email,
    country,
    noteSummary,
    preferredLanguage,
    status
  };
}

export async function createCustomerAction(
  _previousState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  await requireAdmin();

  try {
    const password = readText(formData, "password");
    const {
      phone,
      internalName,
      fullName,
      email,
      country,
      noteSummary,
      preferredLanguage,
      status
    } = readCustomerFields(formData);

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.rpc("create_customer_admin", {
      input_phone: phone,
      input_password: password,
      input_internal_name: internalName,
      input_preferred_language: preferredLanguage,
      input_status: status,
      input_full_name: fullName,
      input_email: email,
      input_country: country,
      input_note_summary: noteSummary
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/admin/customers");
    return { success: "Customer created." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Customer creation failed."
    };
  }
}

export async function updateCustomerAction(
  _previousState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const session = await requireAdmin();

  try {
    const customerId = readText(formData, "customer_id");
    const {
      phone,
      internalName,
      fullName,
      email,
      country,
      noteSummary,
      preferredLanguage,
      status
    } = readCustomerFields(formData);

    if (!customerId) {
      throw new Error("Customer ID is required.");
    }

    const supabase = createSupabaseAdminClient();
    const { data: existingCustomer, error: existingCustomerError } =
      await supabase
        .from("customers")
        .select("status")
        .eq("id", customerId)
        .is("deleted_at", null)
        .maybeSingle();

    if (existingCustomerError) {
      throw new Error(existingCustomerError.message);
    }

    if (!existingCustomer) {
      throw new Error("Customer not found.");
    }

    const { error } = await supabase.rpc("update_customer_admin", {
      input_customer_id: customerId,
      input_phone: phone,
      input_internal_name: internalName,
      input_preferred_language: preferredLanguage,
      input_status: status,
      input_full_name: fullName,
      input_email: email,
      input_country: country,
      input_note_summary: noteSummary
    });

    if (error) {
      throw new Error(error.message);
    }

    if (existingCustomer.status !== status) {
      await createAgentAuditLog({
        actorAgentId: session.id,
        actorRole: "admin",
        action: "customer_status_changed",
        customerId,
        oldValue: { status: existingCustomer.status as string },
        newValue: { status }
      });
    }

    revalidatePath("/admin/customers");
    return { success: "Customer updated." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Customer update failed."
    };
  }
}

export async function resetCustomerPasswordAction(
  _previousState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  await requireAdmin();

  try {
    const customerId = readText(formData, "customer_id");
    const password = readText(formData, "password");

    if (!customerId) {
      throw new Error("Customer ID is required.");
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.rpc("reset_customer_password_admin", {
      input_customer_id: customerId,
      input_password: password
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/admin/customers");
    return { success: "Password reset." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Password reset failed."
    };
  }
}
