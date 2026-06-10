"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canManageCustomers } from "@/lib/auth";
import { getCurrentSession } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type TagActionState = {
  error?: string;
  success?: string;
};

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function requireStaff() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login/agent");
  }

  if (session.role !== "agent" && session.role !== "admin") {
    redirect("/dashboard");
  }

  return session;
}

function revalidateTagSurfaces() {
  revalidatePath("/dashboard/conversations");
  revalidatePath("/admin/customers");
}

export async function addCustomerTagAction(
  _previousState: TagActionState,
  formData: FormData
): Promise<TagActionState> {
  const session = await requireStaff();

  try {
    const customerId = readText(formData, "customer_id");
    const name = readText(formData, "name");
    const color = readText(formData, "color") || "#128c7e";

    if (!customerId) {
      throw new Error("Customer is required.");
    }

    if (!name) {
      throw new Error("Tag name is required.");
    }

    if (name.length > 40) {
      throw new Error("Tag name is too long.");
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("customer_tags").insert({
      customer_id: customerId,
      created_by_agent_id: session.id,
      name,
      color
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidateTagSurfaces();
    return { success: "Tag added." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Tag creation failed."
    };
  }
}

export async function deleteCustomerTagAction(
  _previousState: TagActionState,
  formData: FormData
): Promise<TagActionState> {
  const session = await requireStaff();

  if (!canManageCustomers(session.role)) {
    redirect("/dashboard");
  }

  try {
    const tagId = readText(formData, "tag_id");

    if (!tagId) {
      throw new Error("Tag is required.");
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("customer_tags")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", tagId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(error.message);
    }

    revalidateTagSurfaces();
    return { success: "Tag deleted." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Tag delete failed."
    };
  }
}
