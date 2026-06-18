import { createSupabaseAdminClient } from "@/lib/supabase";

export type LoginActorType = "customer" | "agent";

export type LoginRequestContext = {
  ipAddress: string;
  userAgent: string;
};

export type LoginLogInput = LoginRequestContext & {
  actorType: LoginActorType;
  identifier: string;
  result: "success" | "failed";
  failureReason?: string | null;
  customerId?: string | null;
  agentId?: string | null;
};

const LOGIN_WINDOW_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 5;

export const TOO_MANY_LOGIN_ATTEMPTS_MESSAGE =
  "Too many login attempts. Please try again later.";

export function normalizeLoginIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

export async function assertLoginNotLocked(
  actorType: LoginActorType,
  identifier: string
) {
  const normalizedIdentifier = normalizeLoginIdentifier(identifier);
  const since = new Date(
    Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000
  ).toISOString();
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("login_logs")
    .select("id", { count: "exact", head: true })
    .eq("actor_type", actorType)
    .eq("result", "failed")
    .eq("identifier", normalizedIdentifier)
    .gte("created_at", since)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }

  if ((count ?? 0) >= MAX_FAILED_ATTEMPTS) {
    throw new Error(TOO_MANY_LOGIN_ATTEMPTS_MESSAGE);
  }
}

export async function createLoginLog(input: LoginLogInput) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("login_logs").insert({
    actor_type: input.actorType,
    identifier: normalizeLoginIdentifier(input.identifier),
    customer_id: input.customerId ?? null,
    agent_id: input.agentId ?? null,
    result: input.result,
    failure_reason: input.failureReason ?? null,
    ip_address: input.ipAddress,
    user_agent: input.userAgent
  });

  if (error) {
    throw new Error(error.message);
  }
}
