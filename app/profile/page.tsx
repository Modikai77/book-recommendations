import { SiteShell } from "@/components/site-shell";
import { demoTasteProfile } from "@/lib/demo-data";

export default function ProfilePage() {
  return (
    <SiteShell>
      <section className="space-y-5 md:space-y-6">
        <div className="rounded-[1.75rem] border border-stone-200 bg-white/75 p-5 md:rounded-[2rem] md:p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Profile</p>
          <h1 className="mt-2 font-serif text-3xl sm:text-4xl">Taste profile</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">{demoTasteProfile.summary}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-stone-200 bg-white/80 p-4 md:rounded-[1.75rem] md:p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-stone-500">Preferred genres</p>
            <p className="mt-3 text-sm text-stone-700">{demoTasteProfile.likedGenres.join(", ")}</p>
          </div>
          <div className="rounded-[1.5rem] border border-stone-200 bg-white/80 p-4 md:rounded-[1.75rem] md:p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-stone-500">Preferred tones</p>
            <p className="mt-3 text-sm text-stone-700">{demoTasteProfile.preferredTones.join(", ")}</p>
          </div>
          <div className="rounded-[1.5rem] border border-stone-200 bg-white/80 p-4 md:rounded-[1.75rem] md:p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-stone-500">Preferred lengths</p>
            <p className="mt-3 text-sm text-stone-700">{demoTasteProfile.preferredLengths.join(", ")}</p>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
