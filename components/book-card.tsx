import Link from "next/link";
import type { BookRecord } from "@/lib/types";

export function BookCard({ book }: { book: BookRecord }) {
  return (
    <article className="rounded-[1.75rem] border border-stone-200 bg-white/80 p-5 shadow-sm shadow-stone-200/70">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-stone-500">{book.author}</p>
          <h3 className="mt-2 font-serif text-2xl font-semibold text-stone-900">{book.title}</h3>
        </div>
        {book.catalogStatus ? (
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">{book.catalogStatus}</span>
        ) : null}
      </div>
      <p className="mt-4 text-sm leading-6 text-stone-700">
        {book.metadata?.shortSummary || book.canonicalSummary || "Summary will be generated after ingestion."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {(book.tags || []).map((tag) => (
          <span key={tag} className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900">
            {tag}
          </span>
        ))}
      </div>
      <Link href={`/books/${book.id}`} className="mt-5 inline-flex text-sm font-medium text-stone-900 underline">
        View book
      </Link>
    </article>
  );
}
