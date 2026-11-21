import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoTasteProfile } from "@/lib/demo-data";
import { recommendBooks } from "@/lib/recommendations";
import type { BookRecord } from "@/lib/types";

const create = vi.hoisted(() => vi.fn());
vi.mock("@/lib/openai", () => ({
  OPENAI_RECOMMENDATION_OPTIONS: { model: "gpt-6.2-sol", reasoning: { effort: "medium" } },
  getOpenAIClient: () => ({ responses: { create } }), createEmbeddings: vi.fn()
}));

const query = "I want a short fiction novel that is not about family sagas";
const intent = {
  required: ["short", "fiction novel"], avoid: ["family sagas"], preferred: [],
  requiredLength: "short", requiredForm: "novel", positiveSearch: "short fiction novel",
  minPages: null, maxPages: null, broaderQuery: "A fiction novel of any length that is not a family saga"
};
const book = (id: string, traits: NonNullable<NonNullable<BookRecord["metadata"]>["readingTraits"]>): BookRecord => ({
  id, title: id, author: "Author", metadata: { readingTraits: traits }
});
const heist = book("heist", { form: "novel", length: "short", premise: "Two brothers rob a bank.", pageCount: 184, pageSource: "https://publisher.example/heist" });
const saga = book("saga", { form: "novel", length: "short", premise: "Three generations inherit the same estate." });
const long = book("long", { form: "novel", length: "long" });
const memoir = book("memoir", { form: "memoir", length: "short" });
const match = { id: "heist", requiredEvidence: ["Short", "Novel"], exclusionEvidence: ["A bank robbery drives the story"], fit: 5, explanation: "A short heist novel about two brothers." };
const reply = (data: unknown) => create.mockResolvedValueOnce({ output_text: JSON.stringify(data) });
beforeEach(() => create.mockReset());

describe("catalogue recommendations", () => {
  it("filters factual contradictions, retains incidental family, and accepts only supported catalogue IDs", async () => {
    reply(intent);
    reply({ matches: [match, match, {...match,id:"saga",exclusionEvidence:[]}, {...match,id:"invented"}] });
    const result = await recommendBooks(query,[long,memoir,saga,heist],demoTasteProfile);
    expect(result.results.map(item => item.book.id)).toEqual(["heist"]);
    const judge = JSON.parse(create.mock.calls[1][0].input[1].content);
    expect(judge.books.map((b: BookRecord) => b.id)).toEqual(["saga","heist"]);
    expect(judge.intent.avoid).toEqual(["family sagas"]);
  });

  it("rejects unknown, unsourced and boundary page counts before judging", async () => {
    reply({...intent, maxPages:199});
    const result = await recommendBooks("under 200 pages", [saga, book("exact", {pageCount:200,pageSource:"https://publisher.example/book"}), book("estimate", {pageCount:190})], demoTasteProfile);
    expect(create).toHaveBeenCalledTimes(1);
    expect(result.results).toEqual([]);
  });

  it("allows longer books for a soft preference", async () => {
    reply({...intent, requiredLength:null, required:["novel"], preferred:["short"], avoid:[]});
    reply({matches:[{...match,id:"long",requiredEvidence:["Novel"],exclusionEvidence:[],explanation:"A longer novel."}]});
    expect((await recommendBooks("A novel, preferably short", [long],demoTasteProfile)).results[0].book.id).toBe("long");
  });

  it("distinguishes model failure from no qualifying titles", async () => {
    create.mockRejectedValueOnce(new Error("unavailable"));
    await expect(recommendBooks(query,[saga],demoTasteProfile)).rejects.toThrow("unavailable");
  });
});
