import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

const CUSTOMER_COUNT = 50;
const MESSAGES_PER_CONVERSATION = 30;
const CHUNK_SIZE = 500;
const runId = `scp-stress-${Date.now()}`;

function loadEnvFile(path) {
  const content = readFileSync(path, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function chunk(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function runStep(label, action) {
  const startedAt = performance.now();
  const result = await action();
  const durationMs = Math.round(performance.now() - startedAt);
  console.log(`${label}: ${durationMs}ms`);
  return result;
}

async function withRetry(label, action, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
  }

  throw new Error(
    `${label} failed after ${attempts} attempts: ${
      lastError instanceof Error ? lastError.message : "unknown error"
    }`
  );
}

async function insertRows(supabase, table, rows) {
  const inserted = [];

  for (const rowsChunk of chunk(rows, CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from(table)
      .insert(rowsChunk)
      .select("id");

    if (error) {
      throw new Error(`${table} insert failed: ${error.message}`);
    }

    inserted.push(...(data ?? []));
  }

  return inserted.map((row) => row.id);
}

async function softDeleteRows(supabase, table, ids) {
  if (ids.length === 0) {
    return;
  }

  const deletedAt = new Date().toISOString();

  for (const idsChunk of chunk(ids, CHUNK_SIZE)) {
    const { error } = await supabase
      .from(table)
      .update({ deleted_at: deletedAt })
      .in("id", idsChunk);

    if (error) {
      throw new Error(`${table} cleanup failed: ${error.message}`);
    }
  }
}

async function countActiveRowsByRunId(supabase, table) {
  const { count } = await withRetry(
    `${table} cleanup verification`,
    async () => {
      const result = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .contains("metadata", { stress_test_run_id: runId })
        .is("deleted_at", null);

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result;
    }
  );

  return count ?? 0;
}

async function listStaffConversationsBenchmark(supabase) {
  const { data: conversations, error: conversationError } = await supabase
    .from("conversations")
    .select(
      "id, customer_id, assigned_agent_id, status, priority, last_message_at, created_at, customers(phone, internal_name, full_name, email, country, note_summary, preferred_language, status, created_at, last_seen_at), assigned_agent:agents!conversations_assigned_agent_id_fkey(id, full_name, email)"
    )
    .is("deleted_at", null)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (conversationError) {
    throw new Error(`conversation list failed: ${conversationError.message}`);
  }

  const conversationIds = (conversations ?? []).map((conversation) => conversation.id);
  const customerIds = (conversations ?? []).map((conversation) => conversation.customer_id);

  const { data: unreadMessages, error: unreadError } = await supabase
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", conversationIds)
    .eq("sender_type", "customer")
    .in("type", ["text", "file"])
    .is("read_at", null)
    .is("deleted_at", null);

  if (unreadError) {
    throw new Error(`unread count failed: ${unreadError.message}`);
  }

  const { data: tags, error: tagError } = await supabase
    .from("customer_tags")
    .select("id, customer_id, name, color, created_at, created_by_agent_id")
    .in("customer_id", customerIds)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (tagError) {
    throw new Error(`tag list failed: ${tagError.message}`);
  }

  return {
    conversationCount: conversations?.length ?? 0,
    unreadMessageCount: unreadMessages?.length ?? 0,
    tagCount: tags?.length ?? 0
  };
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const created = {
  customers: [],
  conversations: [],
  messages: [],
  tags: []
};

try {
  console.log(`run_id: ${runId}`);

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id")
    .eq("is_active", true)
    .in("role", ["agent", "admin"])
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (agentError) {
    throw new Error(`agent lookup failed: ${agentError.message}`);
  }

  if (!agent) {
    throw new Error("No active agent/admin found for stress test.");
  }

  const baseTime = Date.now() - 60 * 60 * 1000;
  const customers = Array.from({ length: CUSTOMER_COUNT }, (_, index) => ({
    phone: `+6000${Date.now()}${String(index + 1).padStart(3, "0")}`,
    password_hash: `stress-test-only-${runId}`,
    internal_name: `Stress Customer ${index + 1}`,
    preferred_language: "en",
    status: "active",
    full_name: `Stress Customer ${index + 1}`,
    email: `stress-${runId}-${index + 1}@example.com`,
    country: "MY",
    note_summary: `Stress test run ${runId}`,
    last_seen_at:
      index % 3 === 0
        ? new Date(Date.now() - 2 * 60 * 1000).toISOString()
        : new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    metadata: { stress_test_run_id: runId }
  }));

  created.customers = await runStep("insert_customers", () =>
    insertRows(supabase, "customers", customers)
  );

  const conversations = created.customers.map((customerId, index) => ({
    customer_id: customerId,
    assigned_agent_id: index % 4 === 0 ? null : agent.id,
    status: index % 10 === 0 ? "closed" : "open",
    priority: index % 7 === 0 ? "high" : "normal",
    channel: "web",
    metadata: { stress_test_run_id: runId }
  }));

  created.conversations = await runStep("insert_conversations", () =>
    insertRows(supabase, "conversations", conversations)
  );

  const tags = created.customers
    .map((customerId, index) =>
      index % 5 === 0
        ? {
            customer_id: customerId,
            created_by_agent_id: agent.id,
            name: "VIP",
            color: "#f59e0b",
            metadata: { stress_test_run_id: runId }
          }
        : null
    )
    .filter(Boolean);

  created.tags = await runStep("insert_vip_tags", () =>
    insertRows(supabase, "customer_tags", tags)
  );

  const messages = [];

  for (let customerIndex = 0; customerIndex < CUSTOMER_COUNT; customerIndex += 1) {
    const customerId = created.customers[customerIndex];
    const conversationId = created.conversations[customerIndex];

    for (let messageIndex = 0; messageIndex < MESSAGES_PER_CONVERSATION; messageIndex += 1) {
      const isCustomerMessage = messageIndex % 2 === 0;
      const createdAt = new Date(
        baseTime +
          customerIndex * 60 * 1000 +
          messageIndex * 90 * 1000
      ).toISOString();

      messages.push({
        conversation_id: conversationId,
        customer_id: isCustomerMessage ? customerId : null,
        agent_id: isCustomerMessage ? null : agent.id,
        sender_type: isCustomerMessage ? "customer" : "agent",
        type: "text",
        body: `Stress ${runId} customer ${customerIndex + 1} message ${messageIndex + 1}`,
        created_at: createdAt,
        read_at: isCustomerMessage && messageIndex % 4 === 0 ? null : createdAt,
        metadata: { stress_test_run_id: runId }
      });
    }
  }

  created.messages = await runStep("insert_messages_1500", () =>
    insertRows(supabase, "messages", messages)
  );

  const benchmark = await runStep("dashboard_query_benchmark", () =>
    listStaffConversationsBenchmark(supabase)
  );

  console.log(
    JSON.stringify(
      {
        expected_customers: CUSTOMER_COUNT,
        expected_conversations: CUSTOMER_COUNT,
        expected_messages: CUSTOMER_COUNT * MESSAGES_PER_CONVERSATION,
        created_counts: {
          customers: created.customers.length,
          conversations: created.conversations.length,
          messages: created.messages.length,
          vip_tags: created.tags.length
        },
        benchmark
      },
      null,
      2
    )
  );
} finally {
  await runStep("cleanup_messages", () =>
    softDeleteRows(supabase, "messages", created.messages)
  );
  await runStep("cleanup_tags", () =>
    softDeleteRows(supabase, "customer_tags", created.tags)
  );
  await runStep("cleanup_conversations", () =>
    softDeleteRows(supabase, "conversations", created.conversations)
  );
  await runStep("cleanup_customers", () =>
    softDeleteRows(supabase, "customers", created.customers)
  );
  const remainingActiveRows = await runStep("cleanup_verification", async () => ({
    messages: await countActiveRowsByRunId(supabase, "messages"),
    tags: await countActiveRowsByRunId(supabase, "customer_tags"),
    conversations: await countActiveRowsByRunId(supabase, "conversations"),
    customers: await countActiveRowsByRunId(supabase, "customers")
  }));

  console.log(
    JSON.stringify(
      {
        remaining_active_test_rows: remainingActiveRows
      },
      null,
      2
    )
  );
}
