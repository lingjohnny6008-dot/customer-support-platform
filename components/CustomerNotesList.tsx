"use client";

import { HighlightText } from "@/components/ConversationSearch";
import type { CustomerNote } from "@/lib/types";

function formatDateTime(value: string | null) {
  if (!value) {
    return "No activity yet";
  }

  return new Date(value).toLocaleString();
}

export function CustomerNotesList({ notes }: { notes: CustomerNote[] }) {
  return (
    <div className="customer-note-list">
      {notes.length === 0 ? (
        <p className="empty-state">No customer notes yet.</p>
      ) : (
        notes.map((note) => (
          <article className="customer-note-item" key={note.id}>
            <p>
              <HighlightText text={note.body} />
            </p>
            <footer>
              <span>{formatDateTime(note.created_at)}</span>
              <strong>{note.author?.full_name ?? "Unknown agent"}</strong>
            </footer>
          </article>
        ))
      )}
    </div>
  );
}
