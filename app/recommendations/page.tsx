import { RecommendationForm } from "@/components/recommendation-form";
import { SiteShell } from "@/components/site-shell";

export default async function RecommendationsPage({
  searchParams
}: {
  searchParams: Promise<{ prompt?: string }>;
}) {
  const { prompt } = await searchParams;

  return (
    <SiteShell>
      <section className="space-y-6">
        <div className="rounded-[2rem] border border-stone-200 bg-white/75 p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Recommendations</p>
          <h1 className="mt-2 font-serif text-4xl">Ask for the kind of book you want right now.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
            Queries are parsed into structure like genre, tone, and length, then ranked against curated books using
            both request intent and the user’s taste profile.
          </p>
        </div>
        <RecommendationForm initialPrompt={prompt} />
      </section>
    </SiteShell>
  );
}
