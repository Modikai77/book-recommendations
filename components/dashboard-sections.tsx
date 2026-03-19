import Link from "next/link";
import { format } from "date-fns";
import type { Route } from "next";
import type { BookRecord, DashboardAttentionItem, DashboardPromptSuggestion, DashboardSourceItem } from "@/lib/types";

export function DashboardActionCards() {
  const actions = [
    {
      title: "Add source",
      detail: "Import an email, web link, or markdown note.",
      href: "/submit-source"
    },
    {
      title: "Ask recommendations",
      detail: "Turn your current library into a focused suggestion list.",
      href: "/recommendations"
    },
    {
      title: "Review library",
      detail: "Browse extracted books, sources, and summaries.",
      href: "/lists"
    }
  ] satisfies Array<{ title: string; detail: string; href: Route }>;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {actions.map((action) => (
        <Link
          key={action.title}
          href={action.href}
          className="rounded-[1.75rem] border border-stone-200 bg-white/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="font-serif text-2xl text-stone-900">{action.title}</p>
          <p className="mt-3 text-sm leading-6 text-stone-700">{action.detail}</p>
          <p className="mt-4 text-sm font-medium text-stone-900 underline">Open</p>
        </Link>
      ))}
    </div>
  );
}

export function RecentSourcesPanel({ sources }: { sources: DashboardSourceItem[] }) {
  return (
    <section className="rounded-[2rem] border border-stone-200 bg-white/80 p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Recent sources</p>
          <h2 className="mt-2 font-serif text-3xl text-stone-900">Latest imports</h2>
        </div>
        <Link href="/submit-source" className="text-sm font-medium text-stone-900 underline">
          Submit another
        </Link>
      </div>

      <div className="mt-5 space-y-3">
        {sources.length ? (
          sources.map((source) => (
            <div key={source.id} className="rounded-[1.25rem] border border-stone-200 bg-stone-50/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-stone-900">{source.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.25em] text-stone-500">{source.type}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-600">{source.status}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-600">
                <span>{source.extractedBookCount} books</span>
                <span>Added {format(new Date(source.submittedAt), "MMM d, yyyy")}</span>
              </div>
              <div className="mt-3">
                <Link
                  href={`/lists?source=${encodeURIComponent(source.title)}`}
                  className="text-sm font-medium text-stone-900 underline"
                >
                  Open in Lists
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[1.25rem] border border-dashed border-stone-300 bg-stone-50/60 p-5 text-sm text-stone-600">
            No sources yet. Start by importing an email, article, or markdown note.
          </div>
        )}
      </div>
    </section>
  );
}

export function RecentBooksPanel({ books }: { books: BookRecord[] }) {
  return (
    <section className="rounded-[2rem] border border-stone-200 bg-white/80 p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Recent books</p>
          <h2 className="mt-2 font-serif text-3xl text-stone-900">Freshly materialized</h2>
        </div>
        <Link href="/lists" className="text-sm font-medium text-stone-900 underline">
          View all
        </Link>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {books.length ? (
          books.map((book) => (
            <article key={book.id} className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-stone-500">{book.author}</p>
              <h3 className="mt-2 font-serif text-2xl text-stone-900">{book.title}</h3>
              <p className="mt-3 text-sm leading-6 text-stone-700">
                {book.metadata?.summary || book.metadata?.shortSummary || book.canonicalSummary || "No summary yet."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(book.tags || []).slice(0, 4).map((tag) => (
                  <span key={tag} className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900">
                    {tag}
                  </span>
                ))}
                {book.sourceTitle ? (
                  <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-600">{book.sourceTitle}</span>
                ) : null}
                {book.submittedAt ? (
                  <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-600">
                    Added {format(new Date(book.submittedAt), "MMM d, yyyy")}
                  </span>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[1.25rem] border border-dashed border-stone-300 bg-stone-50/60 p-5 text-sm text-stone-600 lg:col-span-2">
            No visible books yet. Submit a source and the extracted books will appear here once materialized.
          </div>
        )}
      </div>
    </section>
  );
}

export function LibraryOverviewPanel(props: {
  privateBookCount: number;
  sourceCount: number;
  booksAddedLast7Days: number;
  topTags: Array<{ tag: string; count: number }>;
  sourceBreakdown: Array<{ type: string; count: number }>;
}) {
  return (
    <section className="rounded-[2rem] border border-stone-200 bg-white/80 p-6 shadow-sm">
      <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Library overview</p>
      <h2 className="mt-2 font-serif text-3xl text-stone-900">Current shape of your collection</h2>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 p-4">
          <p className="text-3xl font-semibold text-stone-900">{props.privateBookCount}</p>
          <p className="mt-1 text-sm text-stone-700">Private books</p>
        </div>
        <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 p-4">
          <p className="text-3xl font-semibold text-stone-900">{props.sourceCount}</p>
          <p className="mt-1 text-sm text-stone-700">Submitted sources</p>
        </div>
        <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 p-4">
          <p className="text-3xl font-semibold text-stone-900">{props.booksAddedLast7Days}</p>
          <p className="mt-1 text-sm text-stone-700">Books added in last 7 days</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 p-4">
          <p className="text-sm font-medium text-stone-900">Top tags</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {props.topTags.length ? (
              props.topTags.map((tag) => (
                <span key={tag.tag} className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900">
                  {tag.tag} ({tag.count})
                </span>
              ))
            ) : (
              <p className="text-sm text-stone-600">No tags yet.</p>
            )}
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 p-4">
          <p className="text-sm font-medium text-stone-900">Source breakdown</p>
          <div className="mt-3 space-y-2 text-sm text-stone-700">
            {props.sourceBreakdown.length ? (
              props.sourceBreakdown.map((source) => (
                <div key={source.type} className="flex items-center justify-between gap-4">
                  <span>{source.type}</span>
                  <span>{source.count}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-stone-600">No source activity yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function SuggestedPromptsPanel({ prompts }: { prompts: DashboardPromptSuggestion[] }) {
  return (
    <section className="rounded-[2rem] border border-stone-200 bg-white/80 p-6 shadow-sm">
      <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Recommendation starters</p>
      <h2 className="mt-2 font-serif text-3xl text-stone-900">Try a focused prompt</h2>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {prompts.map((prompt) => (
          <Link
            key={prompt.prompt}
            href={`/recommendations?prompt=${encodeURIComponent(prompt.prompt)}`}
            className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 p-4 transition hover:-translate-y-0.5 hover:shadow-sm"
          >
            <p className="text-sm font-medium text-stone-900">{prompt.label}</p>
            <p className="mt-2 text-sm leading-6 text-stone-700">{prompt.prompt}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function AttentionItemsPanel({ items }: { items: DashboardAttentionItem[] }) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="rounded-[2rem] border border-amber-200 bg-amber-50/70 p-6 shadow-sm">
      <p className="text-xs uppercase tracking-[0.35em] text-amber-800">Needs attention</p>
      <h2 className="mt-2 font-serif text-3xl text-stone-900">A few things worth cleaning up</h2>

      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="block rounded-[1.5rem] border border-amber-200 bg-white/80 p-4 transition hover:shadow-sm"
          >
            <p className="font-medium text-stone-900">{item.title}</p>
            <p className="mt-2 text-sm leading-6 text-stone-700">{item.detail}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
