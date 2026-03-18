import { CatalogStatus, Prisma, SourceStatus, SourceType, SourceVisibility } from "@prisma/client";
import { demoBooks, demoTasteProfile } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";
import { buildTasteProfile } from "@/lib/recommendations";
import type { BookReadingTraits, BookRecord, UserTasteProfile } from "@/lib/types";

export async function listBooksForUser(userId?: string): Promise<BookRecord[]> {
  try {
    const books = await prisma.book.findMany({
      where: userId
        ? {
            OR: [
              { catalogStatus: CatalogStatus.SHARED },
              { mentions: { some: { source: { submittedByUserId: userId } } } }
            ]
          }
        : { catalogStatus: CatalogStatus.SHARED },
      include: {
        metadata: true,
        tags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return books.map((book) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      canonicalSummary: book.canonicalSummary,
      metadata: {
        summary: book.metadata?.summary,
        shortSummary: book.metadata?.shortSummary,
        readingTraits: (book.metadata?.readingTraits as BookReadingTraits | null) ?? undefined,
        tags: book.tags.map((entry) => entry.tag.label)
      },
      tags: book.tags.map((entry) => entry.tag.label),
      catalogStatus: book.catalogStatus
    }));
  } catch {
    return demoBooks;
  }
}

export async function getBookById(id: string) {
  try {
    return await prisma.book.findUnique({
      where: { id },
      include: {
        metadata: true,
        tags: { include: { tag: true } },
        mentions: {
          include: {
            source: true
          }
        }
      }
    });
  } catch {
    return null;
  }
}

export async function getTasteProfile(userId?: string): Promise<UserTasteProfile> {
  if (!userId) {
    return demoTasteProfile;
  }

  try {
    const likedBooks = await prisma.userBookInteraction.findMany({
      where: {
        userId,
        interactionType: { in: ["LIKED", "MARKED_READ"] }
      },
      include: {
        book: {
          include: { metadata: true, tags: { include: { tag: true } } }
        }
      }
    });

    if (!likedBooks.length) {
      return demoTasteProfile;
    }

    return buildTasteProfile(
      userId,
      likedBooks.map(({ book }) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        canonicalSummary: book.canonicalSummary,
        metadata: {
          summary: book.metadata?.summary,
          shortSummary: book.metadata?.shortSummary,
          readingTraits: (book.metadata?.readingTraits as BookReadingTraits | null) ?? undefined,
          tags: book.tags.map((entry) => entry.tag.label)
        },
        tags: book.tags.map((entry) => entry.tag.label),
        catalogStatus: book.catalogStatus
      }))
    );
  } catch {
    return demoTasteProfile;
  }
}

export async function createSourceRecord(input: {
  submittedByUserId: string;
  type: SourceType;
  title?: string;
  rawText: string;
  parsedText?: string;
  sourceUrl?: string;
  sourceFilename?: string;
  sourceMetadata?: Prisma.InputJsonValue;
}) {
  return prisma.source.create({
    data: {
      submittedByUserId: input.submittedByUserId,
      type: input.type,
      title: input.title,
      rawText: input.rawText,
      parsedText: input.parsedText,
      sourceUrl: input.sourceUrl,
      sourceFilename: input.sourceFilename,
      sourceMetadata: input.sourceMetadata,
      visibility: SourceVisibility.PRIVATE,
      status: SourceStatus.NEEDS_REVIEW
    }
  });
}
