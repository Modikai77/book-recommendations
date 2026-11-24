import type { ExtractedBookCandidate } from "@/lib/types";

// Offset always points to the first unread character. A little preceding
// context keeps a heading or a title attached to a paragraph across a cut.
export function nextPassage(text: string, offset: number, size = 4000) {
  let end = Math.min(offset + size, text.length);
  if (end < text.length) {
    const window = text.slice(offset, end);
    const newline = window.lastIndexOf("\n");
    const split = newline >= size / 2 ? newline : window.lastIndexOf(" ");
    if (split >= size / 2) end = offset + split + 1;
  }
  return { text: text.slice(Math.max(0, offset - 350), end), end };
}

export function newCandidates(existing: ExtractedBookCandidate[], incoming: ExtractedBookCandidate[]) {
  const normalize = (value: string) => value.normalize("NFKC").toLowerCase()
    .replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  const key = (book: ExtractedBookCandidate) => JSON.stringify([normalize(book.title), normalize(book.author)]);
  const seen = new Set(existing.map(key));
  return incoming.filter(book => {
    const id = key(book);
    if (!book.title.trim() || !book.author.trim() || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
