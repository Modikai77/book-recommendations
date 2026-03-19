"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import type { BookRecord } from "@/lib/types";

type Props = {
  books: BookRecord[];
};

export function PrivateLibrary({ books }: Props) {
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");

  const sourceOptions = useMemo(
    () => ["all", ...new Set(books.map((book) => book.sourceTitle).filter(Boolean) as string[])],
    [books]
  );
  const tagOptions = useMemo(
    () => ["all", ...new Set(books.flatMap((book) => book.tags || []))],
    [books]
  );

  const filteredBooks = useMemo(() => {
    const normalized = query.toLowerCase().trim();

    return books.filter((book) => {
      const matchesQuery =
        !normalized ||
        [book.title, book.author, book.sourceTitle, book.metadata?.summary, ...(book.tags || [])]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalized));

      const matchesSource = sourceFilter === "all" || book.sourceTitle === sourceFilter;
      const matchesTag = tagFilter === "all" || (book.tags || []).includes(tagFilter);

      return matchesQuery && matchesSource && matchesTag;
    });
  }, [books, query, sourceFilter, tagFilter]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-[2rem] border border-stone-200 bg-white/80 p-5 md:grid-cols-[1.5fr_1fr_1fr]">
        <label className="space-y-2 text-sm">
          <span className="text-stone-700">Search title, tags, description, source</span>
          <input
            className="w-full rounded-2xl border border-stone-200 px-4 py-3"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tyler Cowen, history, AI, biography..."
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-stone-700">Filter by source</span>
          <select
            className="w-full rounded-2xl border border-stone-200 px-4 py-3"
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
          >
            {sourceOptions.map((source) => (
              <option key={source} value={source}>
                {source === "all" ? "All sources" : source}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-stone-700">Filter by tag</span>
          <select
            className="w-full rounded-2xl border border-stone-200 px-4 py-3"
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
          >
            {tagOptions.map((tag) => (
              <option key={tag} value={tag}>
                {tag === "all" ? "All tags" : tag}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-[1.75rem] border border-stone-200 bg-white/75 p-5 text-sm text-stone-600">
        {filteredBooks.length} private books found
      </div>

      <div className="space-y-4">
        {filteredBooks.map((book) => (
          <article key={book.id} className="rounded-[1.75rem] border border-stone-200 bg-white/80 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-stone-500">{book.author}</p>
                <h2 className="mt-2 font-serif text-2xl text-stone-900">{book.title}</h2>
              </div>
              {book.sourceTitle ? (
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">{book.sourceTitle}</span>
              ) : null}
            </div>
            <p className="mt-4 text-sm leading-6 text-stone-700">
              {book.metadata?.summary || book.metadata?.shortSummary || book.canonicalSummary || "No summary yet."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(book.tags || []).map((tag) => (
                <span key={tag} className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900">
                  {tag}
                </span>
              ))}
              {book.sourceType ? (
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">{book.sourceType}</span>
              ) : null}
              {book.submittedAt ? (
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
                  Added {format(new Date(book.submittedAt), "MMM d, yyyy")}
                </span>
              ) : null}
            </div>
          </article>
        ))}
        {!filteredBooks.length ? (
          <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-white/60 p-8 text-sm text-stone-600">
            No private books match the current search and filters.
          </div>
        ) : null}
      </div>
    </div>
  );
}
