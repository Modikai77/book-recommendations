import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ responses: vi.fn(), embeddings: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = { create: api.responses };
    embeddings = { create: api.embeddings };
  }
}));

import { enrichBookSummaries, enrichBookTags, extractBooksFromSource, regenerateSingleBookSummary } from "@/lib/source-processing";
import { parseRecommendationQueryWithAI } from "@/lib/recommendations";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test-only-not-a-real-key");
  for (const key of ["OPENAI_EXTRACTION_MODEL", "OPENAI_SUMMARY_MODEL", "OPENAI_TAGGING_MODEL", "OPENAI_RECOMMENDATION_MODEL"]) {
    vi.stubEnv(key, "gpt-5.5");
  }
  api.embeddings.mockResolvedValue({ data: [] });
});
afterEach(() => vi.unstubAllEnvs());

describe("GPT-6.1 Sol migration", () => {
  it("uses Sol with low reasoning for every text API task even with stale deployment overrides", async () => {
    const book = { title: "Small Things Like These", author: "Claire Keegan" };
    api.responses
      .mockResolvedValueOnce({ model: "gpt-6.1-sol", output_text: JSON.stringify({ books: [book] }) })
      .mockResolvedValueOnce({ output_text: JSON.stringify({ books: [{ id: "0", ...book, summary: "A novel about moral courage in a small Irish town." }] }) })
      .mockResolvedValueOnce({ output_text: JSON.stringify({ books: [{ id: "0", tags: ["Fiction"] }] }) })
      .mockResolvedValueOnce({ output_text: JSON.stringify({ summary: "A novel about moral courage in a small Irish town." }) })
      .mockResolvedValueOnce({ output_text: JSON.stringify({ originalQuery: "short fiction", desiredGenres: ["fiction"] }) });

    const extraction = await extractBooksFromSource({ type: "email", parsedText: "Small Things Like These by Claire Keegan" });
    expect(extraction.modelName).toBe("gpt-6.1-sol");
    expect(extraction.books).toHaveLength(1);
    expect((await enrichBookSummaries({ parsedText: "Book recommendations", books: [book] }))[0].bookSummary).toContain("moral courage");
    expect((await enrichBookTags([book]))[0].tags).toContain("Fiction");
    expect((await regenerateSingleBookSummary({ ...book, parsedText: "Book recommendations" })).summary).toContain("moral courage");
    expect((await parseRecommendationQueryWithAI("short fiction")).desiredGenres).toEqual(["fiction"]);

    expect(api.responses).toHaveBeenCalledTimes(5);
    for (const [payload] of api.responses.mock.calls) {
      expect(payload).toMatchObject({ model: "gpt-6.1-sol", reasoning: { effort: "low" }, text: { format: { type: "json_schema" } } });
    }
    expect(api.embeddings).toHaveBeenCalledWith(expect.objectContaining({ model: "text-embedding-3-small" }));
  });
});
