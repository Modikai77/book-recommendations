import { NextResponse } from "next/server";
import { Prisma, SourceType } from "@prisma/client";
import { z } from "zod";
import { createSourceRecord, materializePrivateBooksForSource } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { getRequiredSessionUser } from "@/lib/session-user";
import { enrichBookEmbeddings, enrichBookSummaries, extractBooksFromSource, normalizeSourceInput } from "@/lib/source-processing";

const sourceSchema = z.object({
  type: z.enum(["email", "web_link", "markdown"]),
  title: z.string().optional(),
  rawText: z.string().optional(),
  url: z.string().url().optional(),
  sourceFilename: z.string().optional(),
  sourceMetadata: z.record(z.string(), z.unknown()).optional()
});

export async function POST(request: Request) {
  try {
    const sessionResult = await getRequiredSessionUser();
    if ("error" in sessionResult) {
      return sessionResult.error;
    }

    const payload = sourceSchema.parse(await request.json());
    const normalized = await normalizeSourceInput(payload);
    const extracted = await extractBooksFromSource({
      type: payload.type,
      parsedText: normalized.parsedText || normalized.rawText,
      metadata: normalized.metadata
    });
    const enrichedBooks = await enrichBookSummaries({
      parsedText: normalized.parsedText || normalized.rawText,
      sourceTitle: payload.title || normalized.title,
      recommender: extracted.recommender,
      books: extracted.books
    });
    const embeddedBooks = await enrichBookEmbeddings(enrichedBooks);

    const source = await createSourceRecord({
      submittedByUserId: sessionResult.user.id,
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
          summariesGenerated: true
        })
      ) as Prisma.InputJsonValue
    });

    await prisma.sourceExtraction.create({
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
    });

    await materializePrivateBooksForSource({
      sourceId: source.id,
      sourceType: payload.type.toUpperCase() as SourceType,
      sourceTitle: source.title,
      recommender: extracted.recommender,
      books: embeddedBooks
    });

    return NextResponse.json({
      sourceId: source.id,
      status: source.status,
      extractedBooks: embeddedBooks.map(({ title, author, bookSummary }) => ({ title, author, bookSummary }))
    });
  } catch (error) {
    console.error("Failed to submit source", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown submission error"
      },
      { status: 500 }
    );
  }
}
