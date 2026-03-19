"use client";

import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import type { BookRecord } from "@/lib/types";

type Props = {
  books: BookRecord[];
  initialQuery?: string;
  initialSourceFilter?: string;
  initialTagFilter?: string;
};

export function PrivateLibrary({ books, initialQuery = "", initialSourceFilter = "all", initialTagFilter = "all" }: Props) {
  const router = useRouter();
  const [bookSummaries, setBookSummaries] = useState<Record<string, string>>(
    Object.fromEntries(
      books.map((book) => [
        book.id,
        book.metadata?.summary || book.metadata?.shortSummary || book.canonicalSummary || "No summary yet."
      ])
    )
  );
  const [query, setQuery] = useState(initialQuery);
  const [sourceFilter, setSourceFilter] = useState(initialSourceFilter);
  const [tagFilter, setTagFilter] = useState(initialTagFilter);
  const [pendingBookId, setPendingBookId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  function redoSummary(bookId: string) {
    setPendingBookId(bookId);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/books/${bookId}/resummarize`, {
          method: "POST"
        });

        const payload = (await response.json().catch(() => null)) as { error?: string; summary?: string } | null;
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to redo summary");
        }

        if (payload?.summary) {
          setBookSummaries((current) => ({
            ...current,
            [bookId]: payload.summary as string
          }));
        }
        router.refresh();
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed to redo summary");
      } finally {
        setPendingBookId(null);
      }
    });
  }

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
      {error ? (
        <div className="rounded-[1.75rem] border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

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
              {bookSummaries[book.id] || "No summary yet."}
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
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => redoSummary(book.id)}
                disabled={isPending && pendingBookId === book.id}
                className="rounded-full border border-stone-300 px-4 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-100 disabled:opacity-60"
              >
                {isPending && pendingBookId === book.id ? "Redoing..." : "Redo Summary"}
              </button>
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
