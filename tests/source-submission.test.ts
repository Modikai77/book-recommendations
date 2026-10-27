import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Keep normalization, extraction, enrichment, and materialization real. Only the
// authenticated session and database boundary are replaced in these route tests.
const db = vi.hoisted(() => ({
  source: { create: vi.fn() },
  sourceExtraction: { create: vi.fn() },
  book: { upsert: vi.fn() },
  recommendationMention: { findFirst: vi.fn(), create: vi.fn() },
  tag: { upsert: vi.fn() },
  bookTag: { upsert: vi.fn() }
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/session-user", () => ({
  getRequiredSessionUser: vi.fn().mockResolvedValue({ user: { id: "user-test", role: "USER" } })
}));

import { POST } from "@/app/api/sources/route";

async function submit(request: Request) {
  const response = await POST(request);
  if (!response) throw new Error("Route returned no response");
  return response;
}

const articleUrl = "https://marginalrevolution.com/marginalrevolution/2026/10/tyler-cowens-strongest-book-recommendations-over-the-years.html";
function request(rawText?: string) {
  return new Request("http://localhost/api/sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "web_link", url: articleUrl, title: "Reading ideas", rawText })
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubEnv("OPENAI_API_KEY", "");
  db.source.create.mockImplementation(async ({ data }) => ({ ...data, id: "source-test" }));
  db.book.upsert.mockImplementation(async ({ create }) => ({ ...create, id: "book-test", metadata: null }));
  db.recommendationMention.findFirst.mockResolvedValue(null);
  db.tag.upsert.mockResolvedValue({ id: "tag-test" });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/sources web links", () => {
  it("reports an upstream block with diagnostics and offers a paste-text fallback", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Blocked", {
      status: 403, statusText: "Forbidden", headers: { "content-type": "text/html", "set-cookie": "session=SECRET" }
    })));
    const response = await submit(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      code: "SOURCE_FETCH_FAILED", canPasteText: true, error: expect.stringContaining("HTTP 403 Forbidden")
    });
    expect(log).toHaveBeenCalledWith("Failed to submit source", expect.objectContaining({
      upstream: { requestedUrl: articleUrl, finalUrl: articleUrl, status: 403, statusText: "Forbidden", contentType: "text/html" },
      cause: expect.objectContaining({ message: "Upstream returned HTTP 403 Forbidden" })
    }));
    expect(JSON.stringify(log.mock.calls)).not.toContain("SECRET");
    expect(db.source.create).not.toHaveBeenCalled();
  });

  it("successfully submits pasted article text without re-fetching the blocked URL", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Publisher refuses retrieval"));
    vi.stubGlobal("fetch", fetchMock);
    const text = "Small Things Like These by Claire Keegan";
    const response = await submit(request(text));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      sourceId: "source-test", status: "NEEDS_REVIEW",
      extractedBooks: [{ title: "Small Things Like These", author: "Claire Keegan" }]
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.source.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      submittedByUserId: "user-test", type: "WEB_LINK", sourceUrl: articleUrl,
      rawText: text, parsedText: text, visibility: "PRIVATE",
      sourceMetadata: expect.objectContaining({ retrievalMethod: "pasted_text" })
    }) });
    expect(db.sourceExtraction.create).toHaveBeenCalledOnce();
    expect(db.book.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ title: "Small Things Like These", author: "Claire Keegan", catalogStatus: "PRIVATE_ONLY" })
    }));
    expect(db.recommendationMention.create).toHaveBeenCalledWith({ data: expect.objectContaining({ sourceId: "source-test", bookId: "book-test" }) });
    expect(console.info).toHaveBeenCalledWith("Source submission", expect.objectContaining({
      stage: "save_books", event: "succeeded", sourceId: "source-test", bookCount: 1
    }));
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(text);
  });

  it("still submits a normal accessible web article", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("<p>Small Things Like These by Claire Keegan</p>"));
    vi.stubGlobal("fetch", fetchMock);
    const response = await submit(request());
    expect(response.status).toBe(200);
    expect((await response.json()).extractedBooks).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(db.source.create).toHaveBeenCalledOnce();
  });

  it("correlates a failed stage with the browser reference without logging pasted text or cookies", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const original = request("Small Things Like These by Claire Keegan");
    const requestId = "bdfbd12d-f2ca-4471-8e02-bdb142f04782";
    original.headers.set("x-submission-id", requestId);
    original.headers.set("cookie", "session=COOKIE_SECRET");
    db.source.create.mockRejectedValueOnce(new Error("Database unavailable"));
    const response = await submit(original);
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ requestId, error: "Database unavailable" });
    expect(log).toHaveBeenCalledWith("Failed to submit source", expect.objectContaining({ requestId, stage: "save_source" }));
    const logs = JSON.stringify([vi.mocked(console.info).mock.calls, log.mock.calls]);
    expect(logs).not.toMatch(/COOKIE_SECRET|Small Things Like These|Claire Keegan/);
    expect(db.sourceExtraction.create).not.toHaveBeenCalled();
  });
});
