import { SiteShell } from "@/components/site-shell";
import { SourceSubmissionForm } from "@/components/source-submission-form";

export default function SubmitSourcePage() {
  return (
    <SiteShell>
      <section className="space-y-6">
        <div className="rounded-[2rem] border border-stone-200 bg-white/75 p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Ingestion</p>
          <h1 className="mt-2 font-serif text-4xl">Submit email, web, or markdown sources.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
            Markdown input is built for Obsidian-style notes. Frontmatter, wiki links, headings, and inline tags are
            preserved as weak context for extraction without requiring direct vault sync.
          </p>
        </div>
        <SourceSubmissionForm />
      </section>
    </SiteShell>
  );
}
