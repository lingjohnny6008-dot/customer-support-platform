"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent
} from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import type {
  InternalNoteActionState,
  MessageActionState
} from "@/app/actions/conversations";
import {
  HighlightText,
  useConversationSearch
} from "@/components/ConversationSearch";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type {
  ChatMessage,
  InternalNote,
  MessageSenderType,
  QuickReply
} from "@/lib/types";

const initialMessageActionState: MessageActionState = {};
const initialInternalNoteActionState: InternalNoteActionState = {};

type TimelineItem =
  | {
      kind: "message";
      created_at: string;
      item: ChatMessage;
    }
  | {
      kind: "internal-note";
      created_at: string;
      item: InternalNote;
    };

type ConversationThreadProps = {
  conversationId: string;
  initialMessages: ChatMessage[];
  initialInternalNotes?: InternalNote[];
  currentUserRole: "customer" | "agent" | "admin";
  currentUserId: string;
  conversationStatus?: "open" | "pending" | "resolved" | "closed";
  supabaseUrl: string;
  supabaseAnonKey: string;
  enableEnterToSend?: boolean;
  quickReplies?: QuickReply[];
  action: (
    previousState: MessageActionState,
    formData: FormData
  ) => Promise<MessageActionState>;
  internalNoteAction?: (
    previousState: InternalNoteActionState,
    formData: FormData
  ) => Promise<InternalNoteActionState>;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button" type="submit" disabled={pending}>
      {pending ? "Sending..." : "Send"}
    </button>
  );
}

function InternalNoteSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button internal-note-submit" type="submit" disabled={pending}>
      {pending ? "Saving..." : "Add internal note"}
    </button>
  );
}

function getMessageOwner(
  message: ChatMessage,
  currentUserRole: ConversationThreadProps["currentUserRole"],
  currentUserId: string
) {
  if (message.sender_type === "customer") {
    return currentUserRole === "customer" && message.customer_id === currentUserId
      ? "mine"
      : "theirs";
  }

  if (message.sender_type === "agent") {
    return currentUserRole !== "customer" ? "mine" : "theirs";
  }

  return "system";
}

function senderLabel(senderType: MessageSenderType) {
  if (senderType === "customer") {
    return "Customer";
  }

  if (senderType === "agent") {
    return "Agent";
  }

  return "System";
}

function shouldShowReadReceipt(
  message: ChatMessage,
  currentUserRole: ConversationThreadProps["currentUserRole"]
) {
  return currentUserRole !== "customer" && message.sender_type === "customer";
}

function getImageUrl(message: ChatMessage) {
  return message.attachments?.[0]?.file_url ?? message.body;
}

function getTypingLabel(currentUserRole: ConversationThreadProps["currentUserRole"]) {
  return currentUserRole === "customer"
    ? "Support is typing..."
    : "Customer is typing...";
}

export function ConversationThread({
  conversationId,
  initialMessages,
  initialInternalNotes = [],
  currentUserRole,
  currentUserId,
  conversationStatus = "open",
  supabaseUrl,
  supabaseAnonKey,
  enableEnterToSend = false,
  quickReplies = [],
  action,
  internalNoteAction
}: ConversationThreadProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);
  const internalNoteFormRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [state, formAction] = useFormState(action, initialMessageActionState);
  const [internalNoteState, internalNoteFormAction] = useFormState(
    internalNoteAction ?? passthroughInternalNoteAction,
    initialInternalNoteActionState
  );
  const [messages, setMessages] = useState(initialMessages);
  const [quickReplyQuery, setQuickReplyQuery] = useState<string | null>(null);
  const [isRemoteTyping, setIsRemoteTyping] = useState(false);
  const typingChannelRef = useRef<ReturnType<
    ReturnType<typeof createSupabaseBrowserClient>["channel"]
  > | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationSearch = useConversationSearch();
  const searchQuery = conversationSearch?.query.trim().toLowerCase() ?? "";
  const canUseInternalNotes =
    Boolean(internalNoteAction) && currentUserRole !== "customer";
  const canSendMessage =
    currentUserRole === "customer" || conversationStatus !== "closed";
  const filteredQuickReplies =
    quickReplyQuery === null
      ? []
      : quickReplies
          .filter((quickReply) =>
            `${quickReply.category} ${quickReply.title} ${quickReply.content}`
              .toLowerCase()
              .includes(quickReplyQuery.toLowerCase())
          )
          .slice(0, 8);
  const timelineItems: TimelineItem[] = [
    ...messages.map((message) => ({
      kind: "message" as const,
      created_at: message.created_at,
      item: message
    })),
    ...(canUseInternalNotes
      ? initialInternalNotes.map((note) => ({
          kind: "internal-note" as const,
          created_at: note.created_at,
          item: note
        }))
      : [])
  ].sort(
    (firstItem, secondItem) =>
      new Date(firstItem.created_at).getTime() -
      new Date(secondItem.created_at).getTime()
  );

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages, conversationId]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey);
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const message = payload.new as ChatMessage;

          if (message.type !== "text" && message.type !== "file") {
            return;
          }

          setMessages((currentMessages) => {
            if (currentMessages.some((item) => item.id === message.id)) {
              return currentMessages;
            }

            return [...currentMessages, message];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, supabaseAnonKey, supabaseUrl]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey);
    const channel = supabase.channel(`typing:${conversationId}`, {
      config: {
        presence: {
          key: `${currentUserRole}:${currentUserId}`
        }
      }
    });

    function syncTypingState() {
      const state = channel.presenceState() as Record<
        string,
        Array<{ role?: ConversationThreadProps["currentUserRole"] }>
      >;
      const remoteUsers = Object.values(state).flat();
      const hasRemoteTyping = remoteUsers.some((user) =>
        currentUserRole === "customer"
          ? user.role === "agent" || user.role === "admin"
          : user.role === "customer"
      );

      setIsRemoteTyping(hasRemoteTyping);
    }

    channel.on("presence", { event: "sync" }, syncTypingState).subscribe();
    typingChannelRef.current = channel;

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [
    conversationId,
    currentUserId,
    currentUserRole,
    supabaseAnonKey,
    supabaseUrl
  ]);

  useEffect(() => {
    if (state.successId) {
      formRef.current?.reset();
      setQuickReplyQuery(null);
      stopTyping();
    }
  }, [state.successId]);

  useEffect(() => {
    if (internalNoteState.successId) {
      internalNoteFormRef.current?.reset();
      router.refresh();
    }
  }, [internalNoteState.successId, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [timelineItems.length]);

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (quickReplyQuery !== null && event.key === "Escape") {
      event.preventDefault();
      setQuickReplyQuery(null);
      return;
    }

    if (!enableEnterToSend || event.key !== "Enter" || event.shiftKey) {
      return;
    }

    if (quickReplyQuery !== null) {
      event.preventDefault();
      return;
    }

    const value = event.currentTarget.value.trim();

    if (!value) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  function startTyping() {
    typingChannelRef.current?.track({
      role: currentUserRole,
      userId: currentUserId,
      typing: true,
      updatedAt: Date.now()
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }

  function stopTyping() {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    typingChannelRef.current?.untrack();
  }

  function handleMessageInputChange(event: ChangeEvent<HTMLTextAreaElement>) {
    startTyping();

    const textarea = event.currentTarget;
    const cursor = textarea.selectionStart;
    const textBeforeCursor = textarea.value.slice(0, cursor);
    const tokenStart = Math.max(
      textBeforeCursor.lastIndexOf(" "),
      textBeforeCursor.lastIndexOf("\n"),
      textBeforeCursor.lastIndexOf("\t")
    );
    const currentToken = textBeforeCursor.slice(tokenStart + 1);

    if (currentToken.startsWith("/")) {
      setQuickReplyQuery(currentToken.slice(1));
      return;
    }

    setQuickReplyQuery(null);
  }

  function insertQuickReply(quickReply: QuickReply) {
    const textarea = messageTextareaRef.current;

    if (!textarea) {
      return;
    }

    const cursor = textarea.selectionStart;
    const textBeforeCursor = textarea.value.slice(0, cursor);
    const textAfterCursor = textarea.value.slice(cursor);
    const tokenStart = Math.max(
      textBeforeCursor.lastIndexOf(" "),
      textBeforeCursor.lastIndexOf("\n"),
      textBeforeCursor.lastIndexOf("\t")
    );
    const prefix = textarea.value.slice(0, tokenStart + 1);
    const nextValue = `${prefix}${quickReply.content}${textAfterCursor}`;

    textarea.value = nextValue;
    setQuickReplyQuery(null);
    startTyping();
    requestAnimationFrame(() => {
      const nextCursor = `${prefix}${quickReply.content}`.length;
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  return (
    <section className="conversation-thread">
      <div className="message-list">
        {timelineItems.length === 0 ? (
          <p className="empty-state">No messages yet.</p>
        ) : (
          timelineItems.map((timelineItem) => {
            const searchableText =
              timelineItem.kind === "message"
                ? timelineItem.item.body ?? ""
                : timelineItem.item.body;
            const isSearchMatch =
              Boolean(searchQuery) &&
              searchableText.toLowerCase().includes(searchQuery);

            if (timelineItem.kind === "internal-note") {
              return (
                <article
                  className={
                    isSearchMatch
                      ? "internal-note-card search-match"
                      : "internal-note-card"
                  }
                  key={`internal-note-${timelineItem.item.id}`}
                >
                  <span>Internal note</span>
                  <p>
                    <HighlightText text={timelineItem.item.body} />
                  </p>
                  <footer>
                    <strong>
                      {timelineItem.item.author?.full_name ?? "Unknown agent"}
                    </strong>
                    <time dateTime={timelineItem.item.created_at}>
                      {new Date(timelineItem.item.created_at).toLocaleString()}
                    </time>
                  </footer>
                </article>
              );
            }

            const message = timelineItem.item;
            const owner = getMessageOwner(
              message,
              currentUserRole,
              currentUserId
            );

            return (
              <article
                className={
                  isSearchMatch
                    ? `message-bubble ${owner} search-match`
                    : `message-bubble ${owner}`
                }
                key={message.id}
              >
                <span>{senderLabel(message.sender_type)}</span>
                {message.type === "file" ? (
                  <a
                    className="message-image-link"
                    href={getImageUrl(message) ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      alt="Chat attachment"
                      src={getImageUrl(message) ?? ""}
                    />
                  </a>
                ) : (
                  <p>
                    <HighlightText text={message.body} />
                  </p>
                )}
                {shouldShowReadReceipt(message, currentUserRole) ? (
                  <small className="message-read-receipt">
                    {message.read_at ? "Read" : "Unread"}
                  </small>
                ) : null}
              </article>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {canUseInternalNotes ? (
        <form
          ref={internalNoteFormRef}
          className="internal-note-form"
          action={internalNoteFormAction}
        >
          <input type="hidden" name="conversation_id" value={conversationId} />
          <textarea
            name="body"
            placeholder="Add an internal note"
            rows={2}
            maxLength={2000}
            required
          />
          <InternalNoteSubmitButton />
          {internalNoteState.error ? (
            <p className="error">{internalNoteState.error}</p>
          ) : null}
        </form>
      ) : null}

      {isRemoteTyping ? (
        <p className="typing-indicator">{getTypingLabel(currentUserRole)}</p>
      ) : null}

      {canSendMessage ? (
        <form ref={formRef} className="message-form" action={formAction}>
          <input type="hidden" name="conversation_id" value={conversationId} />
          <div className="message-input-wrap">
            {quickReplyQuery !== null && quickReplies.length > 0 ? (
              <div className="quick-reply-picker">
                {filteredQuickReplies.length === 0 ? (
                  <p>No quick replies found.</p>
                ) : (
                  filteredQuickReplies.map((quickReply) => (
                    <button
                      key={quickReply.id}
                      type="button"
                      onClick={() => insertQuickReply(quickReply)}
                    >
                      <small>{quickReply.category}</small>
                      <strong>{quickReply.title}</strong>
                      <span>{quickReply.content}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
            <textarea
              ref={messageTextareaRef}
              name="body"
              placeholder="Type a message"
              rows={3}
              maxLength={4000}
              onChange={handleMessageInputChange}
              onKeyDown={handleTextareaKeyDown}
            />
            <input
              className="message-image-input"
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
            />
          </div>
          <SubmitButton />
        </form>
      ) : (
        <p className="closed-conversation-message">
          Conversation is closed. Reopen to reply.
        </p>
      )}
      {state.error ? <p className="error">{state.error}</p> : null}
    </section>
  );
}

async function passthroughInternalNoteAction(
  _previousState: InternalNoteActionState,
  _formData: FormData
): Promise<InternalNoteActionState> {
  return {};
}
