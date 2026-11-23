import { Prisma } from "@prisma/client";
import { htmlToText } from "@/lib/content-fetch";
import { prisma } from "@/lib/prisma";
import { materializePrivateBooksForSource } from "@/lib/data";
import { extractBooksFromSource, enrichBookSummaries, enrichBookTags, enrichBookEmbeddings } from "@/lib/source-processing";

export function newsletterText(email: { text?: string | null; html?: string | null }) {
  if (email.text?.trim()) return email.text.trim();
  return htmlToText((email.html ?? "").replace(/<br\s*\/?\s*>/gi, "\n"));
}

export async function processInbound(id: string, userId: string) {
  // A crashed invocation can be reclaimed after the route's five-minute runtime.
  const lease = new Date();
  const claim = await prisma.source.updateMany({
    where: { id, submittedByUserId: userId, OR: [
      { status: { in: ["SUBMITTED", "FAILED"] } },
      { status: "PARSED", updatedAt: { lt: new Date(lease.getTime() - 310_000) } }
    ] },
    data: { status: "PARSED", updatedAt: lease }
  });
  if (!claim.count) return;
  const owned = { id, submittedByUserId: userId, status: "PARSED" as const, updatedAt: lease };
  try {
    const source = await prisma.source.findUniqueOrThrow({ where: { id } });
    const parsedText = source.rawText;
    const extracted = await extractBooksFromSource({ type: "email", parsedText, metadata: {
      subject: source.title, attribution: "Use the original newsletter author or publication as recommender when supported by the forwarded content."
    } });
    const summaries = await enrichBookSummaries({ parsedText, sourceTitle: source.title ?? undefined,
      recommender: extracted.recommender, books: extracted.books });
    const books = await enrichBookEmbeddings(await enrichBookTags(summaries));
    await prisma.$transaction(async tx => {
      const finished = await tx.source.updateMany({ where: owned, data: { status: "NEEDS_REVIEW" } });
      if (!finished.count) return;
      await tx.sourceExtraction.create({ data: { sourceId: id, modelName: extracted.modelName,
        modelProvider: extracted.modelProvider, extractionJson: JSON.parse(JSON.stringify({
          books, sourceSummary: extracted.sourceSummary, recommender: extracted.recommender
        })) as Prisma.InputJsonValue } });
      await materializePrivateBooksForSource({ sourceId: id, sourceType: "EMAIL",
        sourceTitle: source.title, recommender: extracted.recommender, books }, tx);
    }, { timeout: 60_000 });
  } catch {
    await prisma.source.updateMany({ where: owned, data: { status: "FAILED" } });
    console.error("Forwarded email import failed", { sourceId: id });
  }
}
