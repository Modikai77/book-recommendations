import { describe, expect, it } from "vitest";
import { inferFallbackBookTags, normalizeBookTags } from "@/lib/source-processing";

describe("book tag enrichment helpers", () => {
  it("normalizes tag aliases to the controlled vocabulary", () => {
    expect(normalizeBookTags(["science fiction", "non-fiction", "literary", "SCI FI"])).toEqual([
      "Sci-fi",
      "Nonfiction",
      "Literary Fiction"
    ]);
  });

  it("infers useful fallback tags from book summaries", () => {
    const tags = inferFallbackBookTags({
      title: "A Memory Called Empire",
      author: "Arkady Martine",
      bookSummary: "A political science fiction novel about empire, diplomacy, and identity in a spacefaring future."
    });

    expect(tags).toContain("Fiction");
    expect(tags).toContain("Sci-fi");
    expect(tags).toContain("Politics");
  });
});
