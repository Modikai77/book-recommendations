import { expect, it } from "vitest";
import { nextPassage, newCandidates } from "@/lib/import-batch";

it("preserves the full article across paragraph cuts and oversized paragraphs", () => {
  const text = "a".repeat(2800) + "\n" + "b".repeat(7000) + " last title";
  let offset = 0;
  const ends = [];
  while (offset < text.length) {
    const part = nextPassage(text, offset);
    expect(part.end).toBeGreaterThan(offset);
    expect(part.text).toContain(text.slice(offset, part.end));
    expect(part.text.length).toBeLessThanOrEqual(4350);
    ends.push(part.end);
    offset = part.end;
  }
  expect(ends[0]).toBe(2801);
  expect(offset).toBe(text.length);
});

it("merges case and typography variants but keeps different authors", () => {
  const first = { title: "The Author’s Tale", author: "A. Writer" };
  expect(newCandidates([first], [
    { title: "the  author's TALE", author: "A. Writer " },
    { ...first, author: "Someone Else" },
    { ...first, author: "Someone Else" }
  ])).toEqual([{ ...first, author: "Someone Else" }]);
});
