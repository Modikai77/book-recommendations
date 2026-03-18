import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { getBookById, listBooksForUser } from "@/lib/data";

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await getBookById(id);

  if (!book) {
    const fallback = (await listBooksForUser()).find((entry) => entry.id === id);
    if (!fallback) {
      notFound();
    }

    return (
      <SiteShell>
        <section className="rounded-[2rem] border border-stone-200 bg-white/80 p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">{fallback.author}</p>
          <h1 className="mt-2 font-serif text-5xl">{fallback.title}</h1>
          <p className="mt-6 text-base leading-8 text-stone-700">
            {fallback.canonicalSummary || fallback.metadata?.summary || fallback.metadata?.shortSummary}
          </p>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="space-y-6">
        <div className="rounded-[2rem] border border-stone-200 bg-white/80 p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">{book.author}</p>
          <h1 className="mt-2 font-serif text-5xl">{book.title}</h1>
          <p className="mt-6 text-base leading-8 text-stone-700">
            {book.metadata?.summary || book.canonicalSummary || "Summary pending enrichment."}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.75rem] border border-stone-200 bg-white/80 p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-stone-500">Tags</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {book.tags.map((entry) => (
                <span key={entry.id} className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900">
                  {entry.tag.label}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-stone-200 bg-white/80 p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-stone-500">Recommendation mentions</p>
            <div className="mt-3 space-y-3 text-sm text-stone-700">
              {book.mentions.map((mention) => (
                <div key={mention.id}>
                  <p className="font-medium">{mention.recommendedBy || "Unknown source"}</p>
                  <p>{mention.mentionSummary || mention.mentionContext || "Mention context unavailable."}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
