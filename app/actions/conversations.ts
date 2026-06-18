"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAgentAuditLog } from "@/lib/audit-logs";
import {
  assignConversationToAgent,
  getCustomerStatus,
  getConversationForCustomer,
  getConversationForStaff,
  updateConversationStatus,
  updateCustomerLastSeen
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

export type AssignmentActionState = {
  error?: string;
  success?: string;
};

export type ConversationStatusActionState = {
  error?: string;
  success?: string;
};

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const IMAGE_BUCKET = "chat-attachments";
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const allowedImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);

function validateMessageBody(body: string) {
  if (!body) {
    throw new Error("Message cannot be empty.");
  }

  if (body.length > 4000) {
    throw new Error("Message is too long.");
  }
}

function readImageFile(formData: FormData) {
  const value = formData.get("image");

  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  return value;
}

function validateImageFile(file: File) {
  const extension = allowedImageTypes.get(file.type);

  if (!extension) {
    throw new Error("Only JPG, PNG, and WEBP images are supported.");
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Image must be 10MB or smaller.");
  }

  return extension;
}

async function uploadImageMessage({
  supabase,
  conversationId,
  customerId,
  agentId,
  image
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  conversationId: string;
  customerId?: string;
  agentId?: string;
  image: File;
}) {
  const extension = validateImageFile(image);
  const senderType = customerId ? "customer" : "agent";
  const storagePath = `${conversationId}/${senderType}-${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(storagePath, image, {
      contentType: image.type,
      upsert: false
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicUrlData } = supabase.storage
    .from(IMAGE_BUCKET)
    .getPublicUrl(storagePath);
  const fileUrl = publicUrlData.publicUrl;
  const { data: message, error: messageError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      customer_id: customerId,
      agent_id: agentId,
      sender_type: senderType,
      type: "file",
      body: fileUrl
    })
    .select("id")
    .single();

  if (messageError) {
    throw new Error(messageError.message);
  }

  const { error: attachmentError } = await supabase.from("attachments").insert({
    message_id: message.id,
    file_url: fileUrl,
    file_type: image.type,
    file_size: image.size
  });

  if (attachmentError) {
    throw new Error(attachmentError.message);
  }

  return message.id as string;
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
    const image = readImageFile(formData);

    if (!image) {
      validateMessageBody(body);
    }

    const conversation = await getConversationForCustomer(
      conversationId,
      session.id
    );

    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    const customerStatus = await getCustomerStatus(session.id);

    if (customerStatus === "suspended") {
      throw new Error("Your account is suspended.");
    }

    await updateConversationStatus(conversationId, "open");

    const supabase = createSupabaseAdminClient();
    if (image) {
      const messageId = await uploadImageMessage({
        supabase,
        conversationId,
        customerId: session.id,
        image
      });

      await updateCustomerLastSeen(session.id);
      revalidatePath("/chat");
      revalidatePath("/dashboard/conversations");
      return { successId: messageId };
    }

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

    await updateCustomerLastSeen(session.id);
    revalidatePath("/chat");
    revalidatePath("/dashboard/conversations");
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
    redirect("/staff-login");
  }

  if (session.role !== "agent" && session.role !== "admin") {
    redirect("/dashboard");
  }

  try {
    const conversationId = readText(formData, "conversation_id");
    const body = readText(formData, "body");
    const image = readImageFile(formData);

    if (!image) {
      validateMessageBody(body);
    }

    const conversation = await getConversationForStaff(conversationId);

    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    if (conversation.status === "closed") {
      throw new Error("Conversation is closed. Reopen to reply.");
    }

    const supabase = createSupabaseAdminClient();
    await supabase
      .from("conversations")
      .update({ assigned_agent_id: session.id })
      .eq("id", conversationId)
      .is("assigned_agent_id", null)
      .is("deleted_at", null);

    if (image) {
      const messageId = await uploadImageMessage({
        supabase,
        conversationId,
        agentId: session.id,
        image
      });

      if (!conversation.assigned_agent_id) {
        await createAgentAuditLog({
          actorAgentId: session.id,
          actorRole: session.role,
          action: "conversation_assigned",
          conversationId,
          customerId: conversation.customer_id,
          targetAgentId: session.id,
          oldValue: { assigned_agent_id: null },
          newValue: { assigned_agent_id: session.id },
          metadata: { source: "auto_on_reply" }
        });
      }

      await createAgentAuditLog({
        actorAgentId: session.id,
        actorRole: session.role,
        action: "agent_message_sent",
        conversationId,
        customerId: conversation.customer_id,
        messageId,
        newValue: {
          message_type: "file",
          file_type: image.type,
          file_size: image.size
        }
      });

      revalidatePath("/dashboard/conversations");
      return { successId: messageId };
    }

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

    if (!conversation.assigned_agent_id) {
      await createAgentAuditLog({
        actorAgentId: session.id,
        actorRole: session.role,
        action: "conversation_assigned",
        conversationId,
        customerId: conversation.customer_id,
        targetAgentId: session.id,
        oldValue: { assigned_agent_id: null },
        newValue: { assigned_agent_id: session.id },
        metadata: { source: "auto_on_reply" }
      });
    }

    await createAgentAuditLog({
      actorAgentId: session.id,
      actorRole: session.role,
      action: "agent_message_sent",
      conversationId,
      customerId: conversation.customer_id,
      messageId: data.id as string,
      newValue: { message_type: "text" }
    });

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
    redirect("/staff-login");
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
    redirect("/staff-login");
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

    await createAgentAuditLog({
      actorAgentId: session.id,
      actorRole: session.role,
      action: "internal_note_added",
      conversationId,
      customerId: conversation.customer_id,
      internalNoteId: data.id as string,
      newValue: { body_length: body.length }
    });

    revalidatePath("/dashboard/conversations");
    return { successId: data.id as string };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Internal note failed."
    };
  }
}

export async function assignConversationAction(
  _previousState: AssignmentActionState,
  formData: FormData
): Promise<AssignmentActionState> {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/staff-login");
  }

  if (session.role !== "agent" && session.role !== "admin") {
    redirect("/dashboard");
  }

  try {
    const conversationId = readText(formData, "conversation_id");
    const agentId = readText(formData, "agent_id");

    if (!conversationId) {
      throw new Error("Conversation is required.");
    }

    const conversation = await getConversationForStaff(conversationId);

    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    const normalizedAgentId = agentId || null;

    await assignConversationToAgent(conversationId, normalizedAgentId);

    if (conversation.assigned_agent_id !== normalizedAgentId) {
      await createAgentAuditLog({
        actorAgentId: session.id,
        actorRole: session.role,
        action: !normalizedAgentId
          ? "conversation_unassigned"
          : conversation.assigned_agent_id
            ? "conversation_reassigned"
            : "conversation_assigned",
        conversationId,
        customerId: conversation.customer_id,
        targetAgentId: normalizedAgentId,
        oldValue: { assigned_agent_id: conversation.assigned_agent_id },
        newValue: { assigned_agent_id: normalizedAgentId }
      });
    }

    revalidatePath("/dashboard/conversations");
    return {
      success: normalizedAgentId
        ? "Conversation assigned."
        : "Conversation unassigned."
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Assignment failed."
    };
  }
}

export async function updateConversationStatusAction(
  _previousState: ConversationStatusActionState,
  formData: FormData
): Promise<ConversationStatusActionState> {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/staff-login");
  }

  if (session.role !== "agent" && session.role !== "admin") {
    redirect("/dashboard");
  }

  try {
    const conversationId = readText(formData, "conversation_id");
    const nextStatus = readText(formData, "status");

    if (!conversationId) {
      throw new Error("Conversation is required.");
    }

    if (nextStatus !== "open" && nextStatus !== "closed") {
      throw new Error("Conversation status is invalid.");
    }

    const conversation = await getConversationForStaff(conversationId);

    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    await updateConversationStatus(conversationId, nextStatus);

    if (conversation.status !== nextStatus) {
      await createAgentAuditLog({
        actorAgentId: session.id,
        actorRole: session.role,
        action:
          nextStatus === "closed"
            ? "conversation_closed"
            : "conversation_reopened",
        conversationId,
        customerId: conversation.customer_id,
        oldValue: { status: conversation.status },
        newValue: { status: nextStatus }
      });
    }

    revalidatePath("/dashboard/conversations");
    return {
      success:
        nextStatus === "closed"
          ? "Conversation closed."
          : "Conversation reopened."
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Conversation status failed."
    };
  }
}
