import { getCurrentSession } from "@/lib/auth";
import { forwardingAddress } from "@/lib/inbound-address";
import { ForwardEmail } from "@/components/forward-email";
import { SiteShell } from "@/components/site-shell";
import { SourceSubmissionForm } from "@/components/source-submission-form";

export default async function SubmitSourcePage() {
  const session = await getCurrentSession();
  const secret = process.env.NEXTAUTH_SECRET;
  const address = session?.user?.id && secret && process.env.RESEND_API_KEY && process.env.RESEND_WEBHOOK_SECRET
    ? forwardingAddress(session.user.id, secret) : undefined;
  return (
    <SiteShell>
      <section className="space-y-5 md:space-y-6">
        <div className="rounded-[1.75rem] border border-stone-200 bg-white/75 p-5 md:rounded-[2rem] md:p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Ingestion</p>
          <h1 className="mt-2 font-serif text-3xl sm:text-4xl">Submit email, web, or markdown sources.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
            Markdown input is built for Obsidian-style notes. Frontmatter, wiki links, headings, and inline tags are
            preserved as weak context for extraction without requiring direct vault sync.
          </p>
        </div>
        {address && <ForwardEmail address={address} />}
        <SourceSubmissionForm />
      </section>
    </SiteShell>
  );
}
