import { describe, expect, it, vi } from "vitest";
import { readSubmissionResponse, SubmissionError } from "@/lib/source-submission-client";

const headers = { "content-type": "application/x-ndjson" };

describe("streamed import responses", () => {
  it("handles fragmented JSON and multibyte UTF-8 while reporting progress", async () => {
    const bytes = new TextEncoder().encode([
      { type: "heartbeat" },
      { type: "progress", stage: "summaries", elapsedMs: 10000, bookCount: 26 },
      { type: "result", result: { sourceId: "source-test", status: "NEEDS_REVIEW", extractedBooks: [{ title: "L’Étranger", author: "Albert Camus" }] } }
    ].map((event) => JSON.stringify(event)).join("\n"));
    const body = new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
        controller.close();
      }
    });
    const progress = vi.fn();
    const result = await readSubmissionResponse(new Response(body, { headers }), progress);
    expect(result.extractedBooks?.[0].title).toBe("L’Étranger");
    expect(progress).toHaveBeenCalledWith({ type: "progress", stage: "summaries", elapsedMs: 10000, bookCount: 26 });
  });

  it("treats a premature stream close as uncertain rather than a successful import", async () => {
    const response = new Response('{"type":"heartbeat"}\n', { headers });
    await expect(readSubmissionResponse(response, () => {})).rejects.toThrow("Check your library before retrying");
  });

  it("accepts a terminal result without waiting for the connection to close", async () => {
    const response = new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('{"type":"result","result":{"sourceId":"saved","status":"NEEDS_REVIEW"}}\n'));
    } }), { headers });
    expect(await readSubmissionResponse(response, () => {})).toMatchObject({ sourceId: "saved" });
  });

  it("handles authentication errors and older JSON responses", async () => {
    await expect(readSubmissionResponse(new Response("", { status: 401 }), () => {})).rejects.toBeInstanceOf(SubmissionError);
    expect(await readSubmissionResponse(Response.json({ sourceId: "saved", status: "NEEDS_REVIEW" }), () => {})).toEqual({ sourceId: "saved", status: "NEEDS_REVIEW" });
  });
});
