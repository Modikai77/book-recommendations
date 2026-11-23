"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

export function SourceName({ sourceId, title, onRename }: {
  sourceId?: string | null;
  title?: string | null;
  onRename?: (id: string, title: string) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const label = title || "Untitled source";
  if (!sourceId) return title ? <span className="rounded-full bg-stone-100 px-3 py-1 text-xs">{title}</span> : null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const name = draft?.trim();
    if (!sourceId || !name || saving) return;
    if (name === title) { setDraft(null); return; }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/sources/${encodeURIComponent(sourceId)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: name })
      });
      if (!response.ok) throw new Error();
      onRename?.(sourceId, name);
      setDraft(null);
      router.refresh();
    } catch {
      setError("Couldn’t rename this source. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (draft === null) return (
    <button type="button" aria-label={`Rename source: ${label}`} onClick={() => { setDraft(title ?? ""); setError(""); }}
      className="inline-flex max-w-full items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-left text-xs text-stone-700 hover:bg-stone-200">
      <span>{label}</span><Pencil aria-hidden="true" className="size-3 shrink-0" />
    </button>
  );
  return <form onSubmit={save} className="w-full space-y-2 text-sm text-stone-800">
    <label className="block">Source name
      <input autoFocus value={draft} disabled={saving} onChange={event => setDraft(event.target.value)}
        onKeyDown={event => { if (event.key === "Escape") setDraft(null); }}
        className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2" />
    </label>
    <p className="text-xs">Renames this source on every book from this import.</p>
    <div className="flex gap-3">
      <button disabled={!draft.trim() || saving} className="rounded-full bg-stone-900 px-3 py-1 text-white disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
      <button type="button" disabled={saving} onClick={() => setDraft(null)}>Cancel</button>
    </div>
    {error && <p role="alert">{error}</p>}
  </form>;
}
