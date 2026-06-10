"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";

type ConversationSearchContextValue = {
  query: string;
  setQuery: (query: string) => void;
};

const ConversationSearchContext =
  createContext<ConversationSearchContextValue | null>(null);

export function ConversationSearchProvider({
  children
}: {
  children: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const value = useMemo(() => ({ query, setQuery }), [query]);

  return (
    <ConversationSearchContext.Provider value={value}>
      {children}
    </ConversationSearchContext.Provider>
  );
}

export function useConversationSearch() {
  return useContext(ConversationSearchContext);
}

export function ConversationSearchInput() {
  const search = useConversationSearch();

  if (!search) {
    return null;
  }

  return (
    <label className="conversation-search-field">
      <span>Search conversation</span>
      <input
        type="search"
        value={search.query}
        onChange={(event) => search.setQuery(event.target.value)}
        placeholder="Messages and notes"
      />
    </label>
  );
}

export function HighlightText({ text }: { text: string | null }) {
  const search = useConversationSearch();
  const sourceText = text ?? "";
  const query = search?.query.trim();

  if (!query) {
    return <>{sourceText}</>;
  }

  const lowerSource = sourceText.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let index = lowerSource.indexOf(lowerQuery);

  while (index !== -1) {
    if (index > cursor) {
      parts.push(sourceText.slice(cursor, index));
    }

    parts.push(
      <mark className="search-highlight" key={`${index}-${cursor}`}>
        {sourceText.slice(index, index + query.length)}
      </mark>
    );

    cursor = index + query.length;
    index = lowerSource.indexOf(lowerQuery, cursor);
  }

  if (cursor < sourceText.length) {
    parts.push(sourceText.slice(cursor));
  }

  return <>{parts}</>;
}
