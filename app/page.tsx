import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,_#f6ead0,_#f3f1eb_40%,_#dfe8d8)] px-6 py-10 text-stone-900">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 rounded-[2.5rem] border border-white/50 bg-white/55 p-8 shadow-xl shadow-stone-900/5 backdrop-blur md:grid-cols-[1.25fr_0.9fr] md:p-12">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-stone-500">Marginalia</p>
            <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-tight md:text-7xl">
              Build a personal recommendation engine from trusted book sources.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-700">
              Ingest newsletters, essays, and Obsidian notes. Extract recommended books, summarize them, tag them, and
              return personalized matches for prompts like “short fiction holiday read”.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/dashboard" className="rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white">
                Enter app
              </Link>
              <Link href="/submit-source" className="rounded-full border border-stone-300 px-6 py-3 text-sm font-medium">
                Submit a source
              </Link>
            </div>
          </div>
          <AuthPanel />
        </div>
      </div>
    </main>
  );
}
