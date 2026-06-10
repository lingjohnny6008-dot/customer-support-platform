import { createSupabaseAdminClient } from "@/lib/supabase";
import type { CustomerTag } from "@/lib/types";

export async function listCustomerTags(customerId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("customer_tags")
    .select("id, customer_id, name, color, created_at, created_by_agent_id")
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CustomerTag[];
}

export async function listTagsForCustomers(customerIds: string[]) {
  if (customerIds.length === 0) {
    return new Map<string, CustomerTag[]>();
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("customer_tags")
    .select("id, customer_id, name, color, created_at, created_by_agent_id")
    .in("customer_id", customerIds)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reduce((tagsByCustomer, tag) => {
    const currentTags = tagsByCustomer.get(tag.customer_id) ?? [];
    currentTags.push(tag as CustomerTag);
    tagsByCustomer.set(tag.customer_id, currentTags);
    return tagsByCustomer;
  }, new Map<string, CustomerTag[]>());
}
