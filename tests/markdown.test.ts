import { describe, expect, it } from "vitest";
import { normalizeObsidianMarkdown } from "@/lib/markdown";

describe("normalizeObsidianMarkdown", () => {
  it("extracts frontmatter, wiki links, headings, and inline tags", () => {
    const parsed = normalizeObsidianMarkdown(`---
title: Reading ideas
created: 2025-03-18
---
# Fiction
> [!note] Keep this brief
- [[Small Things Like These]] by Claire Keegan #fiction #short
`);

    expect(parsed.title).toBe("Reading ideas");
    expect(new Date(parsed.frontmatter.created as string | Date).toISOString()).toBe("2025-03-18T00:00:00.000Z");
    expect(parsed.wikiLinks).toEqual(["Small Things Like These"]);
    expect(parsed.inlineTags).toEqual(["fiction", "short"]);
    expect(parsed.headings).toEqual(["Fiction"]);
    expect(parsed.plainText).toContain("Small Things Like These by Claire Keegan");
  });
});
