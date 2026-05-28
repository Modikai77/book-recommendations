"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { BookOpenCheck, CalendarDays, Check, Star, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  getReadLogBooks,
  setDateInputYear,
  sortReadLogBooks,
  todayDateInputValue,
  updateBookReadLog
} from "@/lib/read-log";
import type { BookReadLogRecord, BookRecord, ReadLogSort } from "@/lib/types";

type Props = {
  books: BookRecord[];
  initialQuery?: string;
  initialSourceFilter?: string;
  initialTagFilter?: string;
};

type LibraryView = "library" | "readLog";

export function PrivateLibrary({ books, initialQuery = "", initialSourceFilter = "all", initialTagFilter = "all" }: Props) {
  const router = useRouter();
  const [libraryBooks, setLibraryBooks] = useState(books);
  const [bookSummaries, setBookSummaries] = useState<Record<string, string>>(
    Object.fromEntries(
      books.map((book) => [
        book.id,
        book.metadata?.summary || book.metadata?.shortSummary || book.canonicalSummary || "No summary yet."
      ])
    )
  );
  const [view, setView] = useState<LibraryView>("library");
  const [query, setQuery] = useState(initialQuery);
  const [sourceFilter, setSourceFilter] = useState(initialSourceFilter);
  const [tagFilter, setTagFilter] = useState(initialTagFilter);
  const [showReadBooks, setShowReadBooks] = useState(false);
  const [readLogSort, setReadLogSort] = useState<ReadLogSort>("readAtDesc");
  const [readDialogBook, setReadDialogBook] = useState<BookRecord | null>(null);
  const [readDate, setReadDate] = useState(todayDateInputValue());
  const [readYear, setReadYear] = useState(String(new Date().getFullYear()));
  const [ratingOutOf10, setRatingOutOf10] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setLibraryBooks(books);
  }, [books]);

  const sourceOptions = useMemo(
    () => ["all", ...new Set(libraryBooks.map((book) => book.sourceTitle).filter(Boolean) as string[])],
    [libraryBooks]
  );
  const tagOptions = useMemo(
    () => ["all", ...new Set(libraryBooks.flatMap((book) => book.tags || []))],
    [libraryBooks]
  );

  const filteredBooks = useMemo(() => {
    const normalized = query.toLowerCase().trim();

    return libraryBooks.filter((book) => {
      if (!showReadBooks && book.readLog) {
        return false;
      }

      const matchesQuery =
        !normalized ||
        [book.title, book.author, book.sourceTitle, book.metadata?.summary, ...(book.tags || [])]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalized));

      const matchesSource = sourceFilter === "all" || book.sourceTitle === sourceFilter;
      const matchesTag = tagFilter === "all" || (book.tags || []).includes(tagFilter);

      return matchesQuery && matchesSource && matchesTag;
    });
  }, [libraryBooks, query, sourceFilter, tagFilter, showReadBooks]);

  const hiddenReadBookCount = useMemo(
    () => libraryBooks.filter((book) => book.readLog).length,
    [libraryBooks]
  );

  const readLogBooks = useMemo(
    () => sortReadLogBooks(getReadLogBooks(libraryBooks), readLogSort),
    [libraryBooks, readLogSort]
  );

  function redoSummary(bookId: string) {
    setPendingAction(`summary:${bookId}`);
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
        setPendingAction(null);
      }
    });
  }

  function openReadDialog(book: BookRecord) {
    const initialDate = book.readLog?.readAt ? book.readLog.readAt.slice(0, 10) : todayDateInputValue();
    setReadDialogBook(book);
    setReadDate(initialDate);
    setReadYear(initialDate.slice(0, 4));
    setRatingOutOf10(book.readLog?.ratingOutOf10 ? String(book.readLog.ratingOutOf10) : "");
    setError(null);
  }

  function updateReadDate(value: string) {
    setReadDate(value);
    if (value) {
      setReadYear(value.slice(0, 4));
    }
  }

  function updateReadYear(value: string) {
    setReadYear(value);
    const year = Number(value);
    if (Number.isInteger(year) && year > 0 && year <= 9999) {
      setReadDate(setDateInputYear(readDate, year));
    }
  }

  function shiftReadYear(years: number) {
    const baseDate = readDate ? new Date(`${readDate}T12:00:00`) : new Date();
    baseDate.setFullYear(baseDate.getFullYear() + years);
    const nextDate = todayDateInputValue(baseDate);
    setReadDate(nextDate);
    setReadYear(nextDate.slice(0, 4));
  }

  function saveReadLog(book: BookRecord, mode: "details" | "skip") {
    const payload =
      mode === "skip"
        ? { readAt: null, ratingOutOf10: null }
        : {
            readAt: readDate || null,
            ratingOutOf10: ratingOutOf10 ? Number(ratingOutOf10) : null
          };

    setPendingAction(`read:${book.id}`);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/books/${book.id}/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const responsePayload = (await response.json().catch(() => null)) as
          | { error?: string; readLog?: BookReadLogRecord }
          | null;
        if (!response.ok || !responsePayload?.readLog) {
          throw new Error(responsePayload?.error || "Failed to mark book as read");
        }

        setLibraryBooks((currentBooks) => updateBookReadLog(currentBooks, book.id, responsePayload.readLog ?? null));
        setReadDialogBook(null);
        setView("readLog");
        router.refresh();
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed to mark book as read");
      } finally {
        setPendingAction(null);
      }
    });
  }

  function removeReadLog(book: BookRecord) {
    setPendingAction(`remove-read:${book.id}`);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/books/${book.id}/read`, {
          method: "DELETE"
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Failed to remove read status");
        }

        setLibraryBooks((currentBooks) => updateBookReadLog(currentBooks, book.id, null));
        router.refresh();
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed to remove read status");
      } finally {
        setPendingAction(null);
      }
    });
  }

  const readDialogPending = readDialogBook ? isPending && pendingAction === `read:${readDialogBook.id}` : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 rounded-[1.75rem] border border-stone-200 bg-white/80 p-2 md:rounded-[2rem]">
        <button
          type="button"
          onClick={() => setView("library")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            view === "library" ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100"
          }`}
        >
          Library
        </button>
        <button
          type="button"
          onClick={() => setView("readLog")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
            view === "readLog" ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100"
          }`}
        >
          <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
          Read log
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{readLogBooks.length}</span>
        </button>
      </div>

      {view === "library" ? (
        <>
          <div className="grid gap-3 rounded-[1.75rem] border border-stone-200 bg-white/80 p-4 md:grid-cols-[1.5fr_1fr_1fr_auto] md:items-end md:gap-4 md:rounded-[2rem] md:p-5">
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
            <div className="space-y-2 text-sm">
              <span className="text-stone-700">Read books</span>
              <button
                type="button"
                role="switch"
                aria-checked={showReadBooks}
                onClick={() => setShowReadBooks((current) => !current)}
                className={`inline-flex w-full items-center justify-center rounded-full border px-4 py-3 text-sm font-medium transition md:w-36 ${
                  showReadBooks
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                }`}
              >
                {showReadBooks ? "Hide Read" : "Show Read"}
              </button>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-stone-200 bg-white/75 p-4 text-sm text-stone-600 md:rounded-[1.75rem] md:p-5">
            {filteredBooks.length} private books found
            {!showReadBooks && hiddenReadBookCount ? ` (${hiddenReadBookCount} read hidden)` : ""}
          </div>
        </>
      ) : (
        <div className="grid gap-3 rounded-[1.75rem] border border-stone-200 bg-white/80 p-4 md:grid-cols-[1fr_auto] md:items-end md:gap-4 md:rounded-[2rem] md:p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Read books</p>
            <p className="mt-2 text-sm text-stone-700">{readLogBooks.length} books marked read</p>
          </div>
          <label className="space-y-2 text-sm">
            <span className="text-stone-700">Sort read log</span>
            <select
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 md:w-64"
              value={readLogSort}
              onChange={(event) => setReadLogSort(event.target.value as ReadLogSort)}
            >
              <option value="readAtDesc">When read, newest first</option>
              <option value="readAtAsc">When read, oldest first</option>
              <option value="noDateFirst">No date first</option>
              <option value="titleAsc">Title, A-Z</option>
              <option value="titleDesc">Title, Z-A</option>
              <option value="ratingDesc">Marks, high to low</option>
              <option value="markedAtDesc">Recently marked read</option>
            </select>
          </label>
        </div>
      )}

      {error ? (
        <div className="rounded-[1.75rem] border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {view === "library" ? (
        <div className="space-y-4">
          {filteredBooks.map((book) => (
            <BookListItem
              key={book.id}
              book={book}
              summary={bookSummaries[book.id] || "No summary yet."}
              pendingAction={pendingAction}
              isPending={isPending}
              onRedoSummary={redoSummary}
              onOpenReadDialog={openReadDialog}
            />
          ))}
          {!filteredBooks.length ? (
            <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-white/60 p-8 text-sm text-stone-600">
              No private books match the current search and filters.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {readLogBooks.map((book) => (
            <ReadLogItem
              key={book.id}
              book={book}
              pendingAction={pendingAction}
              isPending={isPending}
              onOpenReadDialog={openReadDialog}
              onRemoveReadLog={removeReadLog}
            />
          ))}
          {!readLogBooks.length ? (
            <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-white/60 p-8 text-sm text-stone-600">
              No books have been marked read yet.
            </div>
          ) : null}
        </div>
      )}

      {readDialogBook ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="read-dialog-title"
            className="w-full max-w-lg rounded-[1.5rem] border border-stone-200 bg-white p-5 shadow-xl md:rounded-[1.75rem] md:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-stone-500">{readDialogBook.author}</p>
                <h2 id="read-dialog-title" className="mt-2 font-serif text-2xl text-stone-900">
                  {readDialogBook.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setReadDialogBook(null)}
                className="rounded-full p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_7rem]">
              <label className="space-y-2 text-sm">
                <span className="text-stone-700">When read</span>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-stone-500" aria-hidden="true" />
                  <input
                    type="date"
                    value={readDate}
                    onChange={(event) => updateReadDate(event.target.value)}
                    className="w-full rounded-2xl border border-stone-200 px-10 py-3"
                  />
                </div>
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-stone-700">Year</span>
                <input
                  type="number"
                  min="1"
                  max="9999"
                  value={readYear}
                  onChange={(event) => updateReadYear(event.target.value)}
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => updateReadDate(todayDateInputValue())}
                className="rounded-full border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-100"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => shiftReadYear(-1)}
                className="rounded-full border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-100"
              >
                1 year ago
              </button>
              <button
                type="button"
                onClick={() => shiftReadYear(-10)}
                className="rounded-full border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-100"
              >
                10 years ago
              </button>
            </div>

            <label className="mt-5 block space-y-2 text-sm">
              <span className="text-stone-700">Marks out of 10</span>
              <div className="relative">
                <Star className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-stone-500" aria-hidden="true" />
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={ratingOutOf10}
                  onChange={(event) => setRatingOutOf10(event.target.value)}
                  className="w-full rounded-2xl border border-stone-200 px-10 py-3"
                />
              </div>
            </label>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => saveReadLog(readDialogBook, "skip")}
                disabled={readDialogPending}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:opacity-60 sm:py-2"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                Skip details
              </button>
              <button
                type="button"
                onClick={() => saveReadLog(readDialogBook, "details")}
                disabled={readDialogPending}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-60 sm:py-2"
              >
                <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
                {readDialogPending ? "Saving..." : "Save details"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BookListItem(props: {
  book: BookRecord;
  summary: string;
  pendingAction: string | null;
  isPending: boolean;
  onRedoSummary: (bookId: string) => void;
  onOpenReadDialog: (book: BookRecord) => void;
}) {
  const { book, summary, pendingAction, isPending, onRedoSummary, onOpenReadDialog } = props;

  return (
    <article className="rounded-[1.5rem] border border-stone-200 bg-white/80 p-4 shadow-sm md:rounded-[1.75rem] md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-stone-500">{book.author}</p>
          <h2 className="mt-2 font-serif text-xl text-stone-900 sm:text-2xl">{book.title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {book.readLog ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800">
              <BookOpenCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Read
            </span>
          ) : null}
          {book.sourceTitle ? (
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">{book.sourceTitle}</span>
          ) : null}
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-stone-700">{summary}</p>
      <BookPills book={book} />
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => onOpenReadDialog(book)}
          disabled={isPending && pendingAction === `read:${book.id}`}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-60 sm:w-auto sm:py-2"
        >
          <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
          {book.readLog ? "Edit read" : "Mark read"}
        </button>
        <button
          type="button"
          onClick={() => onRedoSummary(book.id)}
          disabled={isPending && pendingAction === `summary:${book.id}`}
          className="rounded-full border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:opacity-60 sm:w-auto sm:text-xs sm:py-2"
        >
          {isPending && pendingAction === `summary:${book.id}` ? "Redoing..." : "Redo Summary"}
        </button>
      </div>
    </article>
  );
}

function ReadLogItem(props: {
  book: BookRecord;
  pendingAction: string | null;
  isPending: boolean;
  onOpenReadDialog: (book: BookRecord) => void;
  onRemoveReadLog: (book: BookRecord) => void;
}) {
  const { book, pendingAction, isPending, onOpenReadDialog, onRemoveReadLog } = props;
  const readAt = book.readLog?.readAt ? format(new Date(book.readLog.readAt), "MMM d, yyyy") : "No date";
  const markedAt = book.readLog?.markedAt ? format(new Date(book.readLog.markedAt), "MMM d, yyyy") : null;

  return (
    <article className="rounded-[1.5rem] border border-stone-200 bg-white/80 p-4 shadow-sm md:rounded-[1.75rem] md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-stone-500">{book.author}</p>
          <h2 className="mt-2 font-serif text-xl text-stone-900 sm:text-2xl">{book.title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800">{readAt}</span>
          {book.readLog?.ratingOutOf10 ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900">
              {book.readLog.ratingOutOf10}/10
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-600">
        {book.sourceTitle ? <span className="rounded-full bg-stone-100 px-3 py-1">{book.sourceTitle}</span> : null}
        {markedAt ? <span className="rounded-full bg-stone-100 px-3 py-1">Marked {markedAt}</span> : null}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => onOpenReadDialog(book)}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-700 sm:w-auto sm:py-2"
        >
          <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onRemoveReadLog(book)}
          disabled={isPending && pendingAction === `remove-read:${book.id}`}
          className="rounded-full border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:opacity-60 sm:w-auto sm:py-2"
        >
          {isPending && pendingAction === `remove-read:${book.id}` ? "Marking..." : "Mark not Read"}
        </button>
      </div>
    </article>
  );
}

function BookPills({ book }: { book: BookRecord }) {
  return (
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
      {book.readLog?.readAt ? (
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800">
          Read {format(new Date(book.readLog.readAt), "MMM d, yyyy")}
        </span>
      ) : null}
      {book.readLog && !book.readLog.readAt ? (
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800">Read, no date</span>
      ) : null}
      {book.readLog?.ratingOutOf10 ? (
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900">
          {book.readLog.ratingOutOf10}/10
        </span>
      ) : null}
    </div>
  );
}
