import { describe, expect, it } from "vitest";
import { demoBooks, demoTasteProfile } from "@/lib/demo-data";
import { parseRecommendationQuery, rankRecommendations } from "@/lib/recommendations";

describe("recommendations", () => {
  it("parses a natural-language query into structured fields", () => {
    const parsed = parseRecommendationQuery("short fiction holiday read");

    expect(parsed.desiredLengths).toContain("short");
    expect(parsed.desiredGenres).toContain("fiction");
    expect(parsed.themes).toContain("holiday");
  });

  it("ranks books that match user taste and query signals first", () => {
    const ranked = rankRecommendations(demoBooks, "short reflective fiction", demoTasteProfile);

    expect(ranked[0]?.book.title).toBe("Small Things Like These");
    expect(ranked[0]?.reason.summary).toContain("Matches requested genre");
  });
});
