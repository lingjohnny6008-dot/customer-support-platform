import { createSupabaseAdminClient } from "@/lib/supabase";
import type { ManagedCustomer } from "@/lib/types";

export async function listCustomers(search: string) {
  const supabase = createSupabaseAdminClient();
  const normalizedSearch = search.trim();

  let query = supabase
    .from("customers")
    .select("id, created_at, updated_at, phone, internal_name, preferred_language, status")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (normalizedSearch) {
    const escaped = normalizedSearch.replaceAll("%", "\\%").replaceAll("_", "\\_");
    query = query.or(
      `phone.ilike.%${escaped}%,internal_name.ilike.%${escaped}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ManagedCustomer[];
}
