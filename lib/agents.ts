import { createSupabaseAdminClient } from "@/lib/supabase";
import type { AgentRole, ManagedAgent } from "@/lib/types";

export const agentRoles: AgentRole[] = ["agent", "admin"];

export function isAgentRole(value: string): value is AgentRole {
  return agentRoles.includes(value as AgentRole);
}

export async function listAgents(search: string) {
  const supabase = createSupabaseAdminClient();
  const normalizedSearch = search.trim();

  let query = supabase
    .from("agents")
    .select("id, created_at, updated_at, username, full_name, email, role, is_active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (normalizedSearch) {
    const escaped = normalizedSearch.replaceAll("%", "\\%").replaceAll("_", "\\_");
    query = query.or(
      `username.ilike.%${escaped}%,email.ilike.%${escaped}%,full_name.ilike.%${escaped}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ManagedAgent[];
}

export async function listAssignableAgents() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("agents")
    .select("id, created_at, updated_at, username, full_name, email, role, is_active")
    .is("deleted_at", null)
    .eq("is_active", true)
    .in("role", ["agent", "admin"])
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ManagedAgent[];
}
