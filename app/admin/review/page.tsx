import { SiteShell } from "@/components/site-shell";

const reviewItems = [
  {
    title: "Tyler Cowen March reading email",
    status: "Needs review",
    detail: "10 extracted books, 2 merge candidates, 1 low-confidence title."
  },
  {
    title: "Obsidian note: spring-reading.md",
    status: "Needs review",
    detail: "6 extracted books from bullet lists and headings."
  }
];

export default function AdminReviewPage() {
  return (
    <SiteShell>
      <section className="space-y-5 md:space-y-6">
        <div className="rounded-[1.75rem] border border-stone-200 bg-white/75 p-5 md:rounded-[2rem] md:p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Admin review</p>
          <h1 className="mt-2 font-serif text-3xl sm:text-4xl">Promote the best private submissions into the shared catalog.</h1>
        </div>
        <div className="space-y-4">
          {reviewItems.map((item) => (
            <article key={item.title} className="rounded-[1.5rem] border border-stone-200 bg-white/80 p-4 md:rounded-[1.75rem] md:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-serif text-xl sm:text-2xl">{item.title}</h2>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900">{item.status}</span>
              </div>
              <p className="mt-3 text-sm text-stone-700">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
