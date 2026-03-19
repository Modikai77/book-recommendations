import { redirect } from "next/navigation";
import {
  AttentionItemsPanel,
  DashboardActionCards,
  LibraryOverviewPanel,
  RecentBooksPanel,
  RecentSourcesPanel,
  SuggestedPromptsPanel
} from "@/components/dashboard-sections";
import { SiteShell } from "@/components/site-shell";
import { getCurrentSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/data";

export default async function DashboardPage() {
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    redirect("/");
  }

  const dashboard = await getDashboardData(session.user.id);

  return (
    <SiteShell>
      <section className="space-y-6">
        <div className="rounded-[2rem] border border-stone-200 bg-white/75 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Dashboard</p>
          <h1 className="mt-2 font-serif text-4xl text-stone-900">
            {dashboard.userName ? `Welcome back, ${dashboard.userName}.` : "Welcome back."}
          </h1>
          <p className="mt-3 text-lg text-stone-800">
            {dashboard.privateBookCount} books from {dashboard.sourceCount} sources in your private library.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">{dashboard.guidance}</p>
        </div>

        <DashboardActionCards />

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <RecentBooksPanel books={dashboard.recentBooks} />
          <RecentSourcesPanel sources={dashboard.recentSources} />
        </div>

        <LibraryOverviewPanel
          privateBookCount={dashboard.privateBookCount}
          sourceCount={dashboard.sourceCount}
          booksAddedLast7Days={dashboard.booksAddedLast7Days}
          topTags={dashboard.topTags}
          sourceBreakdown={dashboard.sourceBreakdown}
        />

        <SuggestedPromptsPanel prompts={dashboard.suggestedPrompts} />

        <AttentionItemsPanel items={dashboard.attentionItems} />
      </section>
    </SiteShell>
  );
}
