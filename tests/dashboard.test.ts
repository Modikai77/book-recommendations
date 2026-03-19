import { describe, expect, it } from "vitest";
import { buildAttentionItems, buildSuggestedPromptsFromTags } from "@/lib/data";
import type { BookRecord, DashboardSourceItem } from "@/lib/types";

describe("dashboard helpers", () => {
  it("suggests focused prompts from library tags", () => {
    const prompts = buildSuggestedPromptsFromTags([
      { tag: "technology", count: 4 },
      { tag: "ai", count: 3 },
      { tag: "history", count: 2 }
    ]);

    expect(prompts.map((prompt) => prompt.prompt)).toContain("Books on the impact of technology");
    expect(prompts.map((prompt) => prompt.prompt)).toContain("Readable books about AI and the future");
    expect(prompts.map((prompt) => prompt.prompt)).toContain("Readable history books from my library");
  });

  it("falls back to a general prompt when tags are sparse", () => {
    const prompts = buildSuggestedPromptsFromTags([{ tag: "biography", count: 2 }]);

    expect(prompts).toEqual([{ label: "General", prompt: "What should I read next from my library?" }]);
  });

  it("builds attention items for missing summaries, generic summaries, and empty sources", () => {
    const books: BookRecord[] = [
      {
        id: "book-1",
        title: "Missing Summary Book",
        author: "Author One",
        metadata: { summary: "" },
        tags: []
      },
      {
        id: "book-2",
        title: "Source Blurb Book",
        author: "Author Two",
        metadata: { summary: "Included in Tyler Cowen's stated list of quality, readable non-fiction books." },
        tags: []
      }
    ];

    const sources: DashboardSourceItem[] = [
      {
        id: "source-1",
        title: "Empty Source",
        type: "EMAIL",
        status: "NEEDS_REVIEW",
        submittedAt: new Date().toISOString(),
        extractedBookCount: 0
      }
    ];

    const items = buildAttentionItems(books, sources);

    expect(items.map((item) => item.kind)).toContain("missing_summary");
    expect(items.map((item) => item.kind)).toContain("generic_summary");
    expect(items.map((item) => item.kind)).toContain("empty_source");
  });
});
