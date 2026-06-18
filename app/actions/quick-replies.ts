"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canManageCustomers } from "@/lib/auth";
import { getCurrentSession } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type QuickReplyActionState = {
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
}

function readQuickReplyFields(formData: FormData) {
  const category = readText(formData, "category") || "General";
  const title = readText(formData, "title");
  const content = readText(formData, "content");
  const isActive = formData.get("is_active") === "on";

  if (category.length > 80) {
    throw new Error("Category is too long.");
  }

  if (!title) {
    throw new Error("Title is required.");
  }

  if (!content) {
    throw new Error("Content is required.");
  }

  if (title.length > 100) {
    throw new Error("Title is too long.");
  }

  if (content.length > 4000) {
    throw new Error("Content is too long.");
  }

  return {
    category,
    title,
    content,
    isActive
  };
}

function revalidateQuickReplySurfaces() {
  revalidatePath("/admin/quick-replies");
  revalidatePath("/dashboard/conversations");
}

export async function createQuickReplyAction(
  _previousState: QuickReplyActionState,
  formData: FormData
): Promise<QuickReplyActionState> {
  await requireAdmin();

  try {
    const { category, title, content, isActive } =
      readQuickReplyFields(formData);
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("quick_replies").insert({
      category,
      title,
      content,
      is_active: isActive
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidateQuickReplySurfaces();
    return { success: "Quick reply created." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Quick reply creation failed."
    };
  }
}

export async function updateQuickReplyAction(
  _previousState: QuickReplyActionState,
  formData: FormData
): Promise<QuickReplyActionState> {
  await requireAdmin();

  try {
    const quickReplyId = readText(formData, "quick_reply_id");
    const { category, title, content, isActive } =
      readQuickReplyFields(formData);

    if (!quickReplyId) {
      throw new Error("Quick reply ID is required.");
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("quick_replies")
      .update({
        category,
        title,
        content,
        is_active: isActive
      })
      .eq("id", quickReplyId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(error.message);
    }

    revalidateQuickReplySurfaces();
    return { success: "Quick reply updated." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Quick reply update failed."
    };
  }
}

export async function deactivateQuickReplyAction(
  _previousState: QuickReplyActionState,
  formData: FormData
): Promise<QuickReplyActionState> {
  await requireAdmin();

  try {
    const quickReplyId = readText(formData, "quick_reply_id");

    if (!quickReplyId) {
      throw new Error("Quick reply ID is required.");
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("quick_replies")
      .update({ is_active: false })
      .eq("id", quickReplyId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(error.message);
    }

    revalidateQuickReplySurfaces();
    return { success: "Quick reply deactivated." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Quick reply deactivate failed."
    };
  }
}
