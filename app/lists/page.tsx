import { SiteShell } from "@/components/site-shell";

const sampleLists = [
  { name: "Saved", count: 14, detail: "Interesting books to revisit later." },
  { name: "Read", count: 22, detail: "Finished books that now shape taste profile weighting." },
  { name: "Shortlist for holiday", count: 6, detail: "Hand-picked warm and quiet fiction for travel." }
];

export default function ListsPage() {
  return (
    <SiteShell>
      <section className="space-y-6">
        <div className="rounded-[2rem] border border-stone-200 bg-white/75 p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Lists</p>
          <h1 className="mt-2 font-serif text-4xl">Organize books into saved, read, and custom stacks.</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {sampleLists.map((list) => (
            <article key={list.name} className="rounded-[1.75rem] border border-stone-200 bg-white/80 p-5">
              <p className="text-3xl font-semibold">{list.count}</p>
              <h2 className="mt-2 font-serif text-2xl">{list.name}</h2>
              <p className="mt-3 text-sm text-stone-700">{list.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
