import { createSupabaseAdminClient } from "@/lib/supabase";
import type { QuickReply } from "@/lib/types";

const quickReplySelect =
  "id, created_at, updated_at, category, title, content, is_active";

export async function listQuickReplies(search: string) {
  const supabase = createSupabaseAdminClient();
  const normalizedSearch = search.trim();

  let query = supabase
    .from("quick_replies")
    .select(quickReplySelect)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (normalizedSearch) {
    const escaped = normalizedSearch.replaceAll("%", "\\%").replaceAll("_", "\\_");
    query = query.or(
      `category.ilike.%${escaped}%,title.ilike.%${escaped}%,content.ilike.%${escaped}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as QuickReply[];
}

export async function listActiveQuickReplies() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("quick_replies")
    .select(quickReplySelect)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("category", { ascending: true })
    .order("title", { ascending: true })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as QuickReply[];
}
