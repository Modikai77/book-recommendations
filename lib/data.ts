import { CatalogStatus, Prisma, SourceStatus, SourceType, SourceVisibility } from "@prisma/client";
import { demoBooks, demoTasteProfile } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";
import { buildTasteProfile } from "@/lib/recommendations";
import { slugify } from "@/lib/utils";
import type { BookReadingTraits, BookRecord, ExtractedBookCandidate, UserTasteProfile } from "@/lib/types";

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
        mentions: {
          include: {
            source: true
          },
          orderBy: { createdAt: "desc" },
          take: 1
        },
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
      sourceTitle: book.mentions[0]?.source.title ?? null,
      sourceType: book.mentions[0]?.source.type ?? null,
      submittedAt: book.mentions[0]?.source.createdAt.toISOString() ?? null,
      embedding: (book.metadata?.embedding as number[] | null) ?? undefined,
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
        embedding: (book.metadata?.embedding as number[] | null) ?? undefined,
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

export async function materializePrivateBooksForSource(input: {
  sourceId: string;
  sourceType: SourceType;
  sourceTitle?: string | null;
  recommender?: string | null;
  books: ExtractedBookCandidate[];
}) {
  for (const candidate of input.books) {
    const book = await prisma.book.upsert({
      where: {
        title_author: {
          title: candidate.title,
          author: candidate.author
        }
      },
      update: {
        canonicalSummary: candidate.bookSummary || candidate.rationale || candidate.snippet || undefined
      },
      create: {
        title: candidate.title,
        author: candidate.author,
        canonicalSummary: candidate.bookSummary || candidate.rationale || candidate.snippet || undefined,
        catalogStatus: CatalogStatus.PRIVATE_ONLY,
        metadata: {
          create: {
            summary: candidate.bookSummary || candidate.rationale || candidate.snippet || undefined,
            shortSummary: candidate.bookSummary || candidate.rationale || candidate.snippet || undefined,
            embedding: candidate.embedding ?? undefined
          }
        }
      },
      include: {
        metadata: true
      }
    });

    if (book.metadata) {
      await prisma.bookMetadata.update({
        where: { bookId: book.id },
        data: {
          summary:
            candidate.bookSummary || book.metadata.summary || candidate.rationale || candidate.snippet || undefined,
          shortSummary:
            candidate.bookSummary || book.metadata.shortSummary || candidate.rationale || candidate.snippet || undefined,
          embedding: candidate.embedding ?? (book.metadata.embedding as Prisma.InputJsonValue | undefined) ?? undefined
        }
      });
    }

    const existingMention = await prisma.recommendationMention.findFirst({
      where: {
        sourceId: input.sourceId,
        bookId: book.id
      }
    });

    if (!existingMention) {
      await prisma.recommendationMention.create({
        data: {
          sourceId: input.sourceId,
          bookId: book.id,
          mentionContext: candidate.snippet,
          mentionSummary: candidate.rationale,
          recommendedBy: input.recommender || undefined
        }
      });
    }

    for (const rawTag of candidate.tags ?? []) {
      const label = rawTag.trim();
      if (!label) {
        continue;
      }

      const tag = await prisma.tag.upsert({
        where: { slug: slugify(label) },
        update: { label },
        create: {
          slug: slugify(label),
          label,
          category: "extracted"
        }
      });

      await prisma.bookTag.upsert({
        where: {
          bookId_tagId_source: {
            bookId: book.id,
            tagId: tag.id,
            source: "llm"
          }
        },
        update: {
          score: candidate.confidence ?? 0.5
        },
        create: {
          bookId: book.id,
          tagId: tag.id,
          source: "llm",
          score: candidate.confidence ?? 0.5
        }
      });
    }
  }
}

export async function listPrivateLibraryForUser(userId: string): Promise<BookRecord[]> {
  try {
    const books = await prisma.book.findMany({
      where: {
        mentions: {
          some: {
            source: {
              submittedByUserId: userId
            }
          }
        }
      },
      include: {
        metadata: true,
        mentions: {
          include: {
            source: true
          },
          where: {
            source: {
              submittedByUserId: userId
            }
          },
          orderBy: { createdAt: "desc" },
          take: 1
        },
        tags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    return books.map((book) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      canonicalSummary: book.canonicalSummary,
      sourceTitle: book.mentions[0]?.source.title ?? null,
      sourceType: book.mentions[0]?.source.type ?? null,
      submittedAt: book.mentions[0]?.source.createdAt.toISOString() ?? null,
      embedding: (book.metadata?.embedding as number[] | null) ?? undefined,
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
