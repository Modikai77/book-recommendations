"use client";

import { useState } from "react";

const sourceTypes = [
  { value: "email", label: "Email" },
  { value: "web_link", label: "Web link" },
  { value: "markdown", label: "Markdown / Obsidian" }
] as const;

type SubmissionResponse = {
  sourceId: string;
  status: string;
  extractedBooks?: Array<{ title: string; author: string }>;
};

export function SourceSubmissionForm() {
  const [type, setType] = useState<(typeof sourceTypes)[number]["value"]>("email");
  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [metadata, setMetadata] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubmissionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onMarkdownFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setFileName(file.name);
    setRawText(await file.text());
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim() || undefined,
          rawText: rawText.trim() || undefined,
          url: url.trim() || undefined,
          sourceFilename: fileName.trim() || undefined,
          sourceMetadata: metadata ? JSON.parse(metadata) : undefined
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to submit source");
      }

      const payload = (await response.json()) as SubmissionResponse;
      setResult(payload);
      setRawText("");
      setUrl("");
      setFileName("");
      setMetadata("");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:gap-6">
      <form onSubmit={onSubmit} className="rounded-[1.75rem] border border-stone-200 bg-white/80 p-5 shadow-sm md:rounded-[2rem] md:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="text-stone-700">Source type</span>
            <select
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3"
              value={type}
              onChange={(event) => setType(event.target.value as (typeof sourceTypes)[number]["value"])}
            >
              {sourceTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-stone-700">Source title</span>
            <input
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Tyler Cowen recommendations, March 2025"
            />
          </label>
        </div>

        {type === "web_link" ? (
          <label className="mt-4 block space-y-2 text-sm">
            <span className="text-stone-700">URL</span>
            <input
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://..."
            />
          </label>
        ) : (
          <label className="mt-4 block space-y-2 text-sm">
            <span className="text-stone-700">{type === "markdown" ? "Markdown content" : "Email content"}</span>
            <textarea
              className="min-h-64 w-full rounded-[1.25rem] border border-stone-200 bg-white px-4 py-3 md:min-h-72 md:rounded-[1.5rem]"
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder={
                type === "markdown"
                  ? "---\ntitle: Book ideas\n---\n# Spring reading\n- Small Things Like These by Claire Keegan"
                  : "Paste a forwarded email or recommendation list..."
              }
            />
          </label>
        )}

        {type === "markdown" ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="text-stone-700">Original filename</span>
              <div className="space-y-3">
                <input
                  className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3"
                  value={fileName}
                  onChange={(event) => setFileName(event.target.value)}
                  placeholder="reading-notes.md"
                />
                <input
                  className="block w-full rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm"
                  type="file"
                  accept=".md,text/markdown"
                  onChange={onMarkdownFileChange}
                />
              </div>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-stone-700">Optional metadata JSON</span>
              <input
                className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3"
                value={metadata}
                onChange={(event) => setMetadata(event.target.value)}
                placeholder='{"vault":"Books","path":"Notes/reading.md"}'
              />
            </label>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-full bg-stone-900 px-5 py-3.5 text-sm font-medium text-white disabled:opacity-60 sm:w-auto"
        >
          {loading ? "Submitting..." : "Submit source"}
        </button>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </form>

      <aside className="rounded-[1.75rem] border border-stone-200 bg-stone-900 p-5 text-stone-50 md:rounded-[2rem] md:p-6">
        <h3 className="font-serif text-xl sm:text-2xl">What happens next</h3>
        <ol className="mt-4 space-y-3 text-sm text-stone-200">
          <li>1. The source is normalized based on whether it is email, web content, or markdown.</li>
          <li>2. An extraction step identifies candidate books, snippets, tags, and source context.</li>
          <li>3. The source becomes available in your private workspace immediately.</li>
          <li>4. Admin review can approve high-quality entries into the shared catalog.</li>
        </ol>

        {result ? (
          <div className="mt-6 rounded-[1.25rem] bg-white/10 p-4 md:rounded-[1.5rem]">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-300">Queued</p>
            <p className="mt-2 text-sm">Source ID: {result.sourceId}</p>
            <p className="text-sm">Status: {result.status}</p>
            <div className="mt-3 space-y-2 text-sm">
              {(result.extractedBooks || []).map((book) => (
                <p key={`${book.title}-${book.author}`}>
                  {book.title} by {book.author}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
