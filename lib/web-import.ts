import { Prisma, type Source, type WebImport } from "@prisma/client";
import { send } from "@vercel/queue";
import { ContentFetchError } from "@/lib/content-fetch";
import { materializePrivateBooksForSource } from "@/lib/data";
import { nextPassage, newCandidates } from "@/lib/import-batch";
import { prisma } from "@/lib/prisma";
import { enrichBookEmbeddings, enrichBookSummaries, enrichBookTags, extractBooksFromSource,
  normalizeSourceInput } from "@/lib/source-processing";
import type { ExtractedBookCandidate } from "@/lib/types";

export type ImportMessage = { sourceId: string; revision: number };
type Job = WebImport & { source: Source };
type Extraction = { books: ExtractedBookCandidate[]; recommender?: string; sourceSummary?: string };
type Tx = Prisma.TransactionClient;

const modelOptions = { timeout: 55_000, maxRetries: 0 };
const asJson = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));

export async function dispatchImport({ sourceId, revision }: ImportMessage) {
  await send("web-import", { sourceId, revision }, {
    idempotencyKey: sourceId + "-" + revision, retentionSeconds: 7 * 24 * 3600
  });
}

// Claim this exact checkpoint inside the transaction that writes the books.
// A redelivery or concurrent retry can commit its results only once.
async function checkpoint(job: Job, stage: string, offset: number, bookCount: number,
  save: (tx: Tx) => Promise<void>) {
  await prisma.$transaction(async tx => {
    const updated = await tx.webImport.updateMany({
      where: { sourceId: job.sourceId, revision: job.revision, error: null },
      data: { revision: { increment: 1 }, stage, offset, bookCount }
    });
    if (updated.count) await save(tx);
  }, { timeout: 60_000 });
}

async function advance(job: Job, attempt: number) {
  const source = job.source;
  if (job.stage === "fetch") {
    const article = await normalizeSourceInput({ type: "web_link", url: source.sourceUrl!,
      rawText: source.rawText });
    await checkpoint(job, "extract", 0, 0, async tx => {
      await tx.source.update({ where: { id: source.id }, data: {
        parsedText: article.parsedText, rawText: article.rawText,
        title: source.title || article.title, sourceMetadata: asJson(article.metadata)
      } });
    });
    return;
  }

  const saved = await prisma.sourceExtraction.findUnique({ where: { id: source.id } });
  const extraction = (saved?.extractionJson ?? { books: [] }) as unknown as Extraction;
  const books = extraction.books;
  const parsed = source.parsedText ?? "";
  let changed: ExtractedBookCandidate[];
  let nextStage: string;
  let nextOffset: number;
  let modelName = saved?.modelName ?? "";
  let modelProvider = saved?.modelProvider ?? "";

  if (job.stage === "extract") {
    // A dense list can produce a large response even from a short passage.
    // On redelivery shrink only the uncommitted passage.
    const passage = nextPassage(parsed, job.offset, attempt > 1 ? 1800 : 4000);
    const result = await extractBooksFromSource({ type: "web_link", parsedText: passage.text,
      metadata: { title: source.title, fetchedFrom: source.sourceUrl }, requestOptions: modelOptions });
    changed = newCandidates(books, result.books);
    books.push(...changed);
    extraction.recommender ??= result.recommender;
    extraction.sourceSummary ??= result.sourceSummary;
    modelName = result.modelName;
    modelProvider = result.modelProvider;
    nextStage = passage.end < parsed.length ? "extract" : books.length ? "enrich" : "done";
    nextOffset = nextStage === "extract" ? passage.end : 0;
  } else if (job.stage === "enrich") {
    const batch = books.slice(job.offset, job.offset + 3);
    const summarized = await enrichBookSummaries({ books: batch,
      parsedText: batch.map(book => book.snippet || book.rationale || "").join("\n"),
      sourceTitle: source.title ?? undefined, recommender: extraction.recommender, requestOptions: modelOptions });
    changed = await enrichBookEmbeddings(await enrichBookTags(summarized, modelOptions), modelOptions);
    nextOffset = job.offset + batch.length;
    nextStage = nextOffset < books.length ? "enrich" : "done";
    // Store vectors in BookMetadata, outside the checkpoint reloaded for every batch.
    books.splice(job.offset, batch.length, ...changed.map(book => ({ ...book, embedding: undefined })));
  } else {
    throw new Error("Invalid import stage");
  }

  await checkpoint(job, nextStage, nextOffset, books.length, async tx => {
    const data = { modelName, modelProvider, extractionJson: asJson(extraction),
      confidence: books.length ? books.reduce((n, b) => n + (b.confidence ?? 0.5), 0) / books.length : 0 };
    await tx.sourceExtraction.upsert({ where: { id: source.id },
      create: { id: source.id, sourceId: source.id, ...data }, update: data });
    await materializePrivateBooksForSource({ sourceId: source.id, sourceType: "WEB_LINK",
      sourceTitle: source.title, recommender: extraction.recommender, books: changed,
      preserveExistingSummary: job.stage === "extract" }, tx);
    if (nextStage === "done") {
      await tx.source.update({ where: { id: source.id }, data: { status: "NEEDS_REVIEW",
        sourceMetadata: asJson({ ...(source.sourceMetadata as object), summariesGenerated: true, tagsGenerated: true }) } });
    }
  });
}

export async function processWebImport(message: ImportMessage, attempt: number) {
  const job = await prisma.webImport.findUnique({ where: { sourceId: message.sourceId }, include: { source: true } });
  if (!job || job.error || job.stage === "done") return;
  if (job.revision === message.revision) {
    console.info("Web import", { ...message, stage: job.stage, offset: job.offset, attempt });
    try {
      await advance(job, attempt);
    } catch (error) {
      console.warn("Web import step failed", { ...message, stage: job.stage, attempt,
        errorType: error instanceof Error ? error.name : "unknown" });
      if (attempt < 3) throw error;
      const reason = error instanceof ContentFetchError ? error.message :
        job.stage === "enrich" ? "Book details paused. Your extracted books are in your library." :
        "This batch could not finish. Resume to retry from the last saved batch.";
      await prisma.webImport.updateMany({ where: message, data: { error: reason } });
    }
  }
  // If a previous delivery committed but failed to publish its successor,
  // redelivery re-publishes the current revision using the same idempotency key.
  const current = await prisma.webImport.findUnique({ where: { sourceId: message.sourceId } });
  if (current && !current.error && current.stage !== "done") await dispatchImport(current);
}
