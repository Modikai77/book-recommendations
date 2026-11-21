"use client";

import { useState } from "react";

type RecommendationItem = {
  book: {
    id: string;
    title: string;
    author: string;
    summary?: string | null;
  };
  score: number;
  reason: {
    summary: string;
    signals: string[];
  };

};

export function RecommendationForm({ initialPrompt }: { initialPrompt?: string }) {
  const [query, setQuery] = useState(initialPrompt || "short fiction holiday read");
  const [results, setResults] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [intent, setIntent] = useState<{required: string[]; avoid: string[]; preferred: string[]; broaderQuery: string | null} | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    setIntent(null);
    setResults([]);
    try {
      const response = await fetch("/api/recommendations/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, includePrivate: true })
      });
      if (!response.ok) throw new Error();
      const payload = await response.json();
      setResults(payload.results);
      setIntent(payload.intent);
    } catch {
      setError("Couldn’t check your catalogue. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr] lg:gap-6">
      <form onSubmit={onSubmit} className="rounded-[1.75rem] border border-stone-200 bg-white/80 p-5 shadow-sm md:rounded-[2rem] md:p-6">
        <label className="block space-y-2">
          <span className="text-sm text-stone-700">Ask in natural language</span>
          <textarea
            className="min-h-40 w-full rounded-[1.25rem] border border-stone-200 px-4 py-3 md:min-h-48 md:rounded-[1.5rem]"
            maxLength={4000}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          className="mt-4 w-full rounded-full bg-stone-900 px-5 py-3.5 text-sm font-medium text-white sm:w-auto"
          type="submit" disabled={loading || query.trim().length < 2}
        >
          {loading ? "Thinking..." : "Get recommendations"}
        </button>
      </form>

      <div className="space-y-4">
        {error && <p role="alert">{error}</p>}
        {intent && <div role="status" className="space-y-1">
          {intent.required.length > 0 && <p><strong>Required</strong> · {intent.required.join(", ")}</p>}
          {intent.avoid.length > 0 && <p><strong>Avoid</strong> · {intent.avoid.join(", ")}</p>}
          {intent.preferred.length > 0 && <p><strong>Preferred</strong> · {intent.preferred.join(", ")}</p>}
          {!results.length && <p>No confident matches for this request.</p>}
          {!results.length && intent.broaderQuery && <button type="button" className="text-left underline" onClick={() => setQuery(intent.broaderQuery!)}>Edit search to “{intent.broaderQuery}”</button>}
        </div>}
        {results.map((item) => (
          <article key={item.book.id} className="rounded-[1.5rem] border border-stone-200 bg-white/80 p-4 md:rounded-[1.75rem] md:p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-stone-500">{item.book.author}</p>
            <h3 className="mt-2 font-serif text-xl sm:text-2xl">{item.book.title}</h3>
            <p className="mt-3 text-sm text-stone-700">{item.book.summary}</p>
            <p className="mt-3 text-sm font-medium text-stone-900">{item.reason.summary}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
