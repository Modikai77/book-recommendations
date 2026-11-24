import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/web-imports/route";
import { POST as resume } from "@/app/api/web-imports/[id]/route";
import * as processing from "@/lib/source-processing";
import { processWebImport } from "@/lib/web-import";

const mocks = vi.hoisted(() => ({ send: vi.fn(), session: vi.fn() }));
vi.mock("@vercel/queue", () => ({ send: mocks.send }));
vi.mock("@/lib/session-user", () => ({ getRequiredSessionUser: mocks.session }));

// Run against a disposable, schema-initialized Postgres database.
describe.skipIf(!process.env.WEB_IMPORT_TEST_DB)("durable web import", () => {
  const author = "Import fixture " + randomUUID();
  let userId: string;
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", process.env.WEB_IMPORT_TEST_DB);
    vi.stubEnv("OPENAI_API_KEY", "");
    userId = (await prisma.user.create({ data: {} })).id;
    mocks.session.mockResolvedValue({ user: { id: userId } });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  afterAll(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.book.deleteMany({ where: { author } });
    await prisma.$disconnect();
    vi.unstubAllEnvs();
  });

  it("saves once, survives timeouts and duplicate delivery, and publishes books before enrichment", async () => {
    const id = randomUUID();
    const msg = (revision: number) => ({ sourceId: id, revision });
    const request = () => new Request("http://localhost/api/web-imports", { method: "POST",
      headers: { "X-Submission-Id": id }, body: JSON.stringify({ url: "https://example.org/book-list" }) });
    const fetchPage = vi.fn().mockResolvedValue(new Response(
      "<p>First by " + author + "</p><p>" + "context ".repeat(650) +
      "</p><p>First by " + author + "</p><p>Second by " + author + "</p>"));
    vi.stubGlobal("fetch", fetchPage);
    expect((await POST(request())).status).toBe(202);
    expect((await POST(request())).status).toBe(202);
    expect(fetchPage).not.toHaveBeenCalled();
    await processWebImport(msg(0), 1);
    expect(fetchPage).toHaveBeenCalledOnce();
    const extract = vi.spyOn(processing, "extractBooksFromSource");
    extract.mockRejectedValueOnce(new Error("timeout"));
    await expect(processWebImport(msg(1), 1)).rejects.toThrow("timeout");
    const job = () => prisma.webImport.findUniqueOrThrow({ where: { sourceId: id } });
    expect(await job()).toMatchObject({ revision: 1, offset: 0 });
    // Commit the first batch but lose the acknowledgement of its successor.
    mocks.send.mockRejectedValueOnce(new Error("publish unavailable"));
    await expect(processWebImport(msg(1), 2)).rejects.toThrow("publish unavailable");
    expect((await job()).bookCount).toBe(1);
    await processWebImport(msg(1), 3);
    expect(extract).toHaveBeenCalledTimes(2);
    expect(mocks.send).toHaveBeenLastCalledWith("web-import", msg(2), expect.anything());
    await Promise.all([processWebImport(msg(2), 1), processWebImport(msg(2), 1)]);
    let current = await job();
    while (current.stage === "extract") {
      await processWebImport(msg(current.revision), 1);
      current = await job();
    }
    expect(current).toMatchObject({ stage: "enrich", bookCount: 2 });
    expect(await prisma.recommendationMention.count({ where: { sourceId: id } })).toBe(2);
    const summaries = vi.spyOn(processing, "enrichBookSummaries");
    summaries.mockRejectedValueOnce(new Error("model deadline"));
    await processWebImport(msg(current.revision), 3);
    expect((await job()).error).toContain("Your extracted books");
    const ctx = { params: Promise.resolve({ id }) };
    mocks.session.mockResolvedValueOnce({ user: { id: "another-user" } });
    expect((await resume(request(), ctx)).status).toBe(404);
    expect((await resume(request(), ctx)).status).toBe(204);
    await processWebImport(msg((await job()).revision), 1);
    expect((await job()).stage).toBe("done");
    expect(await (await GET()).json()).toContainEqual(expect.objectContaining({ sourceId: id, bookCount: 2, stage: "done" }));
    expect(fetchPage).toHaveBeenCalledOnce();
    expect(await prisma.sourceExtraction.count({ where: { sourceId: id } })).toBe(1);
  });
});
