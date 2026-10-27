import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Prisma, SourceType } from "@prisma/client";
import { z } from "zod";
import { createSourceRecord, materializePrivateBooksForSource } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { getRequiredSessionUser } from "@/lib/session-user";
import { ContentFetchError, sourceErrorDiagnostics } from "@/lib/content-fetch";
import { OPENAI_DEFAULT_MODEL } from "@/lib/openai";
import type { SubmissionEvent, SubmissionFailure, SubmissionProgress } from "@/lib/source-submission-client";
import {
  enrichBookEmbeddings,
  enrichBookSummaries,
  enrichBookTags,
  extractBooksFromSource,
  normalizeSourceInput
} from "@/lib/source-processing";

const sourceSchema = z.object({
  type: z.enum(["email", "web_link", "markdown"]),
  title: z.string().optional(),
  rawText: z.string().optional(),
  url: z.string().url().optional(),
  sourceFilename: z.string().optional(),
  sourceMetadata: z.record(z.string(), z.unknown()).optional()
});

export async function POST(request: Request) {
  const suppliedId = request.headers.get("x-submission-id");
  const requestId = suppliedId && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(suppliedId)
    ? suppliedId : randomUUID();
  const startedAt = Date.now();
  let stage = "authenticate";
  let onProgress: ((progress: SubmissionProgress) => void) | undefined;
  const trace = (event: string, details: Record<string, unknown> = {}) => {
    console.info("Source submission", { requestId, stage, event, elapsedMs: Date.now() - startedAt, ...details });
    if (event === "started" || event === "books_extracted") {
      onProgress?.({ type: "progress", stage, elapsedMs: Date.now() - startedAt,
        ...(typeof details.bookCount === "number" ? { bookCount: details.bookCount } : {}) });
    }
  };
  function failure(error: unknown): { status: number; payload: SubmissionFailure } {
    console.error("Failed to submit source", { requestId, stage, elapsedMs: Date.now() - startedAt, ...sourceErrorDiagnostics(error) });
    return error instanceof ContentFetchError
      ? { status: 502, payload: { error: error.message, code: "SOURCE_FETCH_FAILED", canPasteText: true, requestId } }
      : { status: 500, payload: { requestId, error: error instanceof Error ? error.message : "Unknown submission error" } };
  }
  async function step<T>(name: string, action: () => Promise<T>): Promise<T> {
    stage = name;
    const started = Date.now();
    trace("started");
    const result = await action();
    trace("completed", { durationMs: Date.now() - started });
    return result;
  }
  try {
    const sessionResult = await step("authenticate", getRequiredSessionUser);
    if ("error" in sessionResult) {
      trace("rejected", { status: sessionResult.error?.status });
      return sessionResult.error;
    }
    const userId = sessionResult.user.id;

    const payload = await step("read_input", async () => sourceSchema.parse(await request.json()));
    trace("input_received", {
      sourceType: payload.type,
      textCharacters: payload.rawText?.length ?? 0,
      pastedText: payload.type === "web_link" && Boolean(payload.rawText?.trim()),
      models: {
        extraction: OPENAI_DEFAULT_MODEL,
        summaries: OPENAI_DEFAULT_MODEL,
        tags: OPENAI_DEFAULT_MODEL,
        embeddings: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small"
      }
    });
    async function processSubmission() {
      const normalized = await step("normalize", () => normalizeSourceInput(payload));
      const extracted = await step("extract", () => extractBooksFromSource({
        type: payload.type,
        parsedText: normalized.parsedText || normalized.rawText,
        metadata: normalized.metadata
      }));
      trace("books_extracted", { bookCount: extracted.books.length, provider: extracted.modelProvider, model: extracted.modelName });
      const enrichedBooks = await step("summaries", () => enrichBookSummaries({
        parsedText: normalized.parsedText || normalized.rawText,
        sourceTitle: payload.title || normalized.title,
        recommender: extracted.recommender,
        books: extracted.books
      }));
      const taggedBooks = await step("tags", () => enrichBookTags(enrichedBooks));
      const embeddedBooks = await step("embeddings", () => enrichBookEmbeddings(taggedBooks));

      const source = await step("save_source", () => createSourceRecord({
        submittedByUserId: userId,
        type: payload.type.toUpperCase() as SourceType,
        title: payload.title || normalized.title,
        rawText: normalized.rawText,
        parsedText: normalized.parsedText,
        sourceUrl: payload.url,
        sourceFilename: payload.sourceFilename,
        sourceMetadata: JSON.parse(
          JSON.stringify({
            ...normalized.metadata,
            ...(payload.sourceMetadata ?? {}),
            summariesGenerated: true,
            tagsGenerated: true
          })
        ) as Prisma.InputJsonValue
      }));
      trace("source_saved", { sourceId: source.id });

      await step("save_extraction", () => prisma.sourceExtraction.create({
        data: {
          sourceId: source.id,
          modelProvider: extracted.modelProvider,
          modelName: extracted.modelName,
          extractionJson: {
            recommender: extracted.recommender,
            sourceSummary: extracted.sourceSummary,
            books: embeddedBooks
          },
          confidence:
            embeddedBooks.length > 0
              ? embeddedBooks.reduce((sum, candidate) => sum + (candidate.confidence ?? 0.5), 0) /
                embeddedBooks.length
              : 0
        }
      }));

      await step("save_books", () => materializePrivateBooksForSource({
        sourceId: source.id,
        sourceType: payload.type.toUpperCase() as SourceType,
        sourceTitle: source.title,
        recommender: extracted.recommender,
        books: embeddedBooks
      }));
      trace("succeeded", { sourceId: source.id, bookCount: embeddedBooks.length });

      return {
        requestId,
        sourceId: source.id,
        status: source.status,
        extractedBooks: embeddedBooks.map(({ title, author, bookSummary, tags }) => ({ title, author, bookSummary, tags }))
      };
    }

    if (request.headers.get("accept")?.includes("application/x-ndjson")) {
      const encoder = new TextEncoder();
      let disconnected = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const send = (event: SubmissionEvent) => {
            if (disconnected) return;
            try {
              controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
            } catch {
              disconnected = true;
              clearInterval(heartbeat);
            }
          };
          onProgress = send;
          // Keep the response active while a single model request takes a while.
          send({ type: "heartbeat" });
          heartbeat = setInterval(() => send({ type: "heartbeat" }), 10_000);
          return processSubmission()
            .then((result) => send({ type: "result", result }))
            .catch((error: unknown) => send({ type: "error", ...failure(error).payload }))
            .finally(() => {
              clearInterval(heartbeat);
              onProgress = undefined;
              if (!disconnected) controller.close();
            });
        },
        cancel() {
          // A lost browser connection must not interrupt database writes already underway.
          disconnected = true;
          clearInterval(heartbeat);
        }
      });
      return new Response(stream, { headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "X-Submission-Id": requestId
      } });
    }
    return NextResponse.json(await processSubmission());
  } catch (error) {
    const errorResponse = failure(error);
    return NextResponse.json(errorResponse.payload, { status: errorResponse.status });
  }
}
