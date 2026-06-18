"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canManageCustomers } from "@/lib/auth";
import { isAgentRole } from "@/lib/agents";
import { getCurrentSession } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type AgentActionState = {
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

function readAgentFields(formData: FormData) {
  const username = readText(formData, "username");
  const email = readText(formData, "email");
  const fullName = readText(formData, "full_name");
  const role = readText(formData, "role");
  const isActive = formData.get("is_active") === "on";

  if (!username) {
    throw new Error("Username is required.");
  }

  if (!email) {
    throw new Error("Email is required.");
  }

  if (!fullName) {
    throw new Error("Full name is required.");
  }

  if (!isAgentRole(role)) {
    throw new Error("Role is invalid.");
  }

  return {
    username,
    email,
    fullName,
    role,
    isActive
  };
}

export async function createAgentAction(
  _previousState: AgentActionState,
  formData: FormData
): Promise<AgentActionState> {
  await requireAdmin();

  try {
    const password = readText(formData, "password");
    const { username, email, fullName, role, isActive } = readAgentFields(formData);

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.rpc("create_agent_admin", {
      input_username: username,
      input_email: email,
      input_password: password,
      input_full_name: fullName,
      input_role: role,
      input_is_active: isActive
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/admin/agents");
    return { success: "Agent created." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Agent creation failed."
    };
  }
}

export async function updateAgentAction(
  _previousState: AgentActionState,
  formData: FormData
): Promise<AgentActionState> {
  await requireAdmin();

  try {
    const agentId = readText(formData, "agent_id");
    const { username, email, fullName, role, isActive } = readAgentFields(formData);

    if (!agentId) {
      throw new Error("Agent ID is required.");
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("agents")
      .update({
        username,
        email,
        full_name: fullName,
        role,
        is_active: isActive
      })
      .eq("id", agentId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/admin/agents");
    return { success: "Agent updated." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Agent update failed."
    };
  }
}

export async function deactivateAgentAction(
  _previousState: AgentActionState,
  formData: FormData
): Promise<AgentActionState> {
  await requireAdmin();

  try {
    const agentId = readText(formData, "agent_id");

    if (!agentId) {
      throw new Error("Agent ID is required.");
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("agents")
      .update({ is_active: false })
      .eq("id", agentId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/admin/agents");
    return { success: "Agent deactivated." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Deactivate failed."
    };
  }
}

export async function resetAgentPasswordAction(
  _previousState: AgentActionState,
  formData: FormData
): Promise<AgentActionState> {
  await requireAdmin();

  try {
    const agentId = readText(formData, "agent_id");
    const password = readText(formData, "password");

    if (!agentId) {
      throw new Error("Agent ID is required.");
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.rpc("reset_agent_password_admin", {
      input_agent_id: agentId,
      input_password: password
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/admin/agents");
    return { success: "Password reset." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Password reset failed."
    };
  }
}
