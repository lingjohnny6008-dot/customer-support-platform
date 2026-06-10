"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getConversationForCustomer,
  getConversationForStaff
} from "@/lib/conversations";
import { getCurrentSession } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type MessageActionState = {
  error?: string;
  successId?: string;
};

export type CustomerNoteActionState = {
  error?: string;
  successId?: string;
};

export type InternalNoteActionState = {
  error?: string;
  successId?: string;
};

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function validateMessageBody(body: string) {
  if (!body) {
    throw new Error("Message cannot be empty.");
  }

  if (body.length > 4000) {
    throw new Error("Message is too long.");
  }
}

export async function sendCustomerMessageAction(
  _previousState: MessageActionState,
  formData: FormData
): Promise<MessageActionState> {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login/customer");
  }

  if (session.role !== "customer") {
    redirect("/dashboard");
  }

  try {
    const conversationId = readText(formData, "conversation_id");
    const body = readText(formData, "body");
    validateMessageBody(body);

    const conversation = await getConversationForCustomer(
      conversationId,
      session.id
    );

    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        customer_id: session.id,
        sender_type: "customer",
        type: "text",
        body
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/chat");
    return { successId: data.id as string };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Message send failed."
    };
  }
}

export async function sendAgentMessageAction(
  _previousState: MessageActionState,
  formData: FormData
): Promise<MessageActionState> {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login/agent");
  }

  if (session.role !== "agent" && session.role !== "admin") {
    redirect("/dashboard");
  }

  try {
    const conversationId = readText(formData, "conversation_id");
    const body = readText(formData, "body");
    validateMessageBody(body);

    const conversation = await getConversationForStaff(conversationId);

    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    const supabase = createSupabaseAdminClient();
    await supabase
      .from("conversations")
      .update({ assigned_agent_id: session.id })
      .eq("id", conversationId)
      .is("assigned_agent_id", null)
      .is("deleted_at", null);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        agent_id: session.id,
        sender_type: "agent",
        type: "text",
        body
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/dashboard/conversations");
    return { successId: data.id as string };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Message send failed."
    };
  }
}

export async function createCustomerNoteAction(
  _previousState: CustomerNoteActionState,
  formData: FormData
): Promise<CustomerNoteActionState> {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login/agent");
  }

  if (session.role !== "agent" && session.role !== "admin") {
    redirect("/dashboard");
  }

  try {
    const customerId = readText(formData, "customer_id");
    const body = readText(formData, "body");

    if (!customerId) {
      throw new Error("Customer is required.");
    }

    if (!body) {
      throw new Error("Note cannot be empty.");
    }

    if (body.length > 2000) {
      throw new Error("Note is too long.");
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("customer_notes")
      .insert({
        customer_id: customerId,
        agent_id: session.id,
        body
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/dashboard/conversations");
    return { successId: data.id as string };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Customer note failed."
    };
  }
}

export async function createInternalNoteAction(
  _previousState: InternalNoteActionState,
  formData: FormData
): Promise<InternalNoteActionState> {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login/agent");
  }

  if (session.role !== "agent" && session.role !== "admin") {
    redirect("/dashboard");
  }

  try {
    const conversationId = readText(formData, "conversation_id");
    const body = readText(formData, "body");

    if (!conversationId) {
      throw new Error("Conversation is required.");
    }

    if (!body) {
      throw new Error("Internal note cannot be empty.");
    }

    if (body.length > 2000) {
      throw new Error("Internal note is too long.");
    }

    const conversation = await getConversationForStaff(conversationId);

    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("internal_notes")
      .insert({
        conversation_id: conversationId,
        agent_id: session.id,
        body
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/dashboard/conversations");
    return { successId: data.id as string };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Internal note failed."
    };
  }
}
