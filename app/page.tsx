import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,_#f6ead0,_#f3f1eb_40%,_#dfe8d8)] px-4 py-6 text-stone-900 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 rounded-[2rem] border border-white/50 bg-white/55 p-5 shadow-xl shadow-stone-900/5 backdrop-blur sm:p-8 md:grid-cols-[1.25fr_0.9fr] md:rounded-[2.5rem] md:p-12">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-stone-500">Marginalia</p>
            <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl md:text-7xl">
              Build a personal recommendation engine from trusted book sources.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-stone-700 sm:text-lg sm:leading-8">
              Ingest newsletters, essays, and Obsidian notes. Extract recommended books, summarize them, tag them, and
              return personalized matches for prompts like “short fiction holiday read”.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
              <Link
                href="/dashboard"
                className="w-full rounded-full bg-stone-900 px-6 py-3 text-center text-sm font-medium text-white sm:w-auto"
              >
                <span className="text-white">Enter app</span>
              </Link>
              <Link
                href="/submit-source"
                className="w-full rounded-full border border-stone-300 px-6 py-3 text-center text-sm font-medium sm:w-auto"
              >
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
