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
  parsedQuery: {
    desiredGenres: string[];
    desiredTones: string[];
    desiredLengths: string[];
  };
};

export function RecommendationForm() {
  const [query, setQuery] = useState("short fiction holiday read");
  const [results, setResults] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const response = await fetch("/api/recommendations/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, includePrivate: true })
    });

    const payload = (await response.json()) as { results: RecommendationItem[] };
    setResults(payload.results);
    setLoading(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <form onSubmit={onSubmit} className="rounded-[2rem] border border-stone-200 bg-white/80 p-6 shadow-sm">
        <label className="block space-y-2">
          <span className="text-sm text-stone-700">Ask in natural language</span>
          <textarea
            className="min-h-48 w-full rounded-[1.5rem] border border-stone-200 px-4 py-3"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button className="mt-4 rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white" type="submit">
          {loading ? "Thinking..." : "Get recommendations"}
        </button>
      </form>

      <div className="space-y-4">
        {results.map((item) => (
          <article key={item.book.id} className="rounded-[1.75rem] border border-stone-200 bg-white/80 p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-stone-500">{item.book.author}</p>
            <h3 className="mt-2 font-serif text-2xl">{item.book.title}</h3>
            <p className="mt-3 text-sm text-stone-700">{item.book.summary}</p>
            <p className="mt-3 text-sm font-medium text-stone-900">{item.reason.summary}</p>
            <p className="mt-2 text-xs text-stone-500">Score: {item.score.toFixed(1)}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
