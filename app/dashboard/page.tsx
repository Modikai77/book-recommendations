import { BookCard } from "@/components/book-card";
import { SiteShell } from "@/components/site-shell";
import { listBooksForUser } from "@/lib/data";

export default async function DashboardPage() {
  const books = await listBooksForUser();

  return (
    <SiteShell>
      <section className="space-y-6">
        <div className="rounded-[2rem] border border-stone-200 bg-white/75 p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Dashboard</p>
          <h1 className="mt-2 font-serif text-4xl">Curated recommendations, organized by source and taste.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
            This MVP combines private-first ingestion, admin review, personalized retrieval, and natural-language book
            discovery from your trusted recommendation sources.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["3", "Source types", "Email, web links, and markdown/Obsidian"],
            ["Private", "Catalog mode", "User submissions stay private until approved"],
            ["LLM", "Enrichment", "Summaries, tags, query interpretation"]
          ].map(([value, label, detail]) => (
            <div key={label} className="rounded-[1.75rem] border border-stone-200 bg-white/80 p-5">
              <p className="text-3xl font-semibold">{value}</p>
              <p className="mt-1 text-sm font-medium text-stone-900">{label}</p>
              <p className="mt-2 text-sm text-stone-600">{detail}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
