"use client";

import { createClient } from "@supabase/supabase-js";

export function createSupabaseBrowserClient(
  supabaseUrl: string,
  anonKey: string
) {
  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
