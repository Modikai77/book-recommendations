"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Job = { sourceId: string; stage: string; error: string | null; bookCount: number;
  updatedAt: string; source: { title: string | null; sourceUrl: string } };

export function WebImportProgress({ onPaste }: { onPaste: (url: string) => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      let delay = 30_000;
      try {
        const response = await fetch("/api/web-imports", { cache: "no-store", signal: abort.signal });
        if (!response.ok) throw new Error();
        const current: Job[] = await response.json();
        if (current.some(job => !job.error && job.stage !== "done")) delay = 4000;
        setJobs(current);
        setError("");
      } catch {
        if (!abort.signal.aborted) setError("Couldn’t load import progress. Reconnecting…");
      } finally {
        if (!abort.signal.aborted) timer = setTimeout(poll, delay);
      }
    }
    void poll();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [refresh]);

  async function resume(id: string) {
    setBusy(id);
    try {
      const response = await fetch("/api/web-imports/" + id, { method: "POST" });
      if (!response.ok) throw new Error();
      setRefresh(n => n + 1);
    } catch {
      setError("Couldn’t resume the import. Try again.");
    } finally {
      setBusy("");
    }
  }
  if (!jobs.length && !error) return null;
  return <section className="mt-5 border-t border-white/20 pt-4">
    <h3 className="font-serif text-xl">Web imports</h3>
    {error && <p role="alert" className="mt-2 text-sm">{error}</p>}
    <ul className="space-y-3 text-sm">{jobs.map(job => {
      const label = job.stage === "fetch" ? "Reading the page" : job.stage === "extract" ? "Finding books" :
        job.stage === "enrich" ? "Adding book details" : "Complete";
      const stalled = job.stage !== "done" && Date.parse(job.updatedAt) < Date.now() - 360_000;
      return <li key={job.sourceId} className="mt-3 break-words">
        <strong>{job.source.title || job.source.sourceUrl}</strong>
        <p>{job.error || label} · {job.bookCount} {job.bookCount === 1 ? "book" : "books"} found</p>
        {job.bookCount > 0 && <Link href="/lists" className="mr-3 underline">View books</Link>}
        {(job.error || stalled) && <button type="button" disabled={busy === job.sourceId}
          onClick={() => resume(job.sourceId)} className="mr-3 underline">Resume import</button>}
        {job.error && job.stage === "fetch" && <button type="button" className="underline"
          onClick={() => onPaste(job.source.sourceUrl)}>Paste article instead</button>}
      </li>;
    })}</ul>
  </section>;
}
