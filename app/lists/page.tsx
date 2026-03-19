import { redirect } from "next/navigation";
import { PrivateLibrary } from "@/components/private-library";
import { SiteShell } from "@/components/site-shell";
import { getCurrentSession } from "@/lib/auth";
import { listPrivateLibraryForUser } from "@/lib/data";

export default async function ListsPage() {
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    redirect("/");
  }

  const books = await listPrivateLibraryForUser(session.user.id);

  return (
    <SiteShell>
      <section className="space-y-6">
        <div className="rounded-[2rem] border border-stone-200 bg-white/75 p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Private library</p>
          <h1 className="mt-2 font-serif text-4xl">Books extracted from your submitted sources.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
            Every successful source submission now materializes private books immediately. Search by title, filter by
            source or tag, and review descriptions without waiting for admin approval.
          </p>
        </div>
        <PrivateLibrary books={books} />
      </section>
    </SiteShell>
  );
}
