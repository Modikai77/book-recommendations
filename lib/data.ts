import { CatalogStatus, Prisma, SourceStatus, SourceType, SourceVisibility } from "@prisma/client";
import { demoBooks, demoTasteProfile } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";
import { buildTasteProfile } from "@/lib/recommendations";
import { slugify } from "@/lib/utils";
import type {
  BookReadingTraits,
  BookRecord,
  DashboardAttentionItem,
  DashboardData,
  DashboardPromptSuggestion,
  DashboardSourceItem,
  ExtractedBookCandidate,
  UserTasteProfile
} from "@/lib/types";

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

export function buildSuggestedPromptsFromTags(
  topTags: Array<{ tag: string; count: number }>
): DashboardPromptSuggestion[] {
  const tags = topTags.map((entry) => entry.tag.toLowerCase());
  const prompts: DashboardPromptSuggestion[] = [];

  if (tags.includes("technology") || tags.includes("ai")) {
    prompts.push({
      label: "Technology",
      prompt: "Books on the impact of technology"
    });
    prompts.push({
      label: "AI",
      prompt: "Readable books about AI and the future"
    });
  }

  if (tags.includes("history")) {
    prompts.push({
      label: "History",
      prompt: "Readable history books from my library"
    });
  }

  if (tags.includes("fiction") && tags.includes("short")) {
    prompts.push({
      label: "Short fiction",
      prompt: "Short fiction I might enjoy next"
    });
  }

  if (tags.includes("politics")) {
    prompts.push({
      label: "Politics",
      prompt: "Readable nonfiction on political history"
    });
  }

  if (!prompts.length) {
    prompts.push({
      label: "General",
      prompt: "What should I read next from my library?"
    });
  }

  return prompts.slice(0, 3);
}

export function buildAttentionItems(
  recentBooks: BookRecord[],
  recentSources: DashboardSourceItem[]
): DashboardAttentionItem[] {
  const items: DashboardAttentionItem[] = [];

  for (const book of recentBooks) {
    const summary = book.metadata?.summary || book.metadata?.shortSummary || book.canonicalSummary || "";
    if (!summary.trim()) {
      items.push({
        id: `missing-${book.id}`,
        kind: "missing_summary",
        title: `Missing summary for ${book.title}`,
        detail: "Regenerate the summary so this book is easier to search and recommend.",
        href: "/lists"
      });
      continue;
    }

    if (
      summary.length < 90 ||
      /included in .* list|recommended by/i.test(summary)
    ) {
      items.push({
        id: `generic-${book.id}`,
        kind: "generic_summary",
        title: `Generic summary for ${book.title}`,
        detail: "This summary still looks source-driven rather than book-driven. Consider redoing it.",
        href: "/lists"
      });
    }
  }

  for (const source of recentSources) {
    if (source.extractedBookCount === 0) {
      items.push({
        id: `empty-${source.id}`,
        kind: "empty_source",
        title: `${source.title} has no visible books yet`,
        detail: "The source was submitted, but nothing materialized into the private library.",
        href: "/submit-source"
      });
    }
  }

  return items.slice(0, 4);
}

function buildGuidance(data: {
  privateBookCount: number;
  sourceCount: number;
  topTags: Array<{ tag: string; count: number }>;
  recentSources: DashboardSourceItem[];
}) {
  if (!data.privateBookCount && !data.sourceCount) {
    return "Start by importing an email, web link, or markdown note to build your private library.";
  }

  const topTag = data.topTags[0]?.tag;
  if (topTag) {
    return `Your recent library is clustering around ${topTag}. Try a focused recommendation prompt next.`;
  }

  if (data.recentSources.length) {
    return "You’ve started importing sources. Review the latest books and try a recommendation prompt from them.";
  }

  return "Your library is ready for another source import or a focused recommendation query.";
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  try {
    const [user, recentSourcesRaw, allBooks, sourceCount, privateBookCount, sourceBreakdownRaw] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true }
      }),
      prisma.source.findMany({
        where: {
          submittedByUserId: userId
        },
        include: {
          extractions: {
            select: {
              extractionJson: true
            },
            orderBy: { createdAt: "desc" },
            take: 1
          }
        },
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      listPrivateLibraryForUser(userId),
      prisma.source.count({
        where: {
          submittedByUserId: userId
        }
      }),
      prisma.book.count({
        where: {
          mentions: {
            some: {
              source: {
                submittedByUserId: userId
              }
            }
          }
        }
      }),
      prisma.source.groupBy({
        by: ["type"],
        where: {
          submittedByUserId: userId
        },
        _count: {
          _all: true
        }
      })
    ]);

    const recentBooks = allBooks.slice(0, 6);

    const recentSources: DashboardSourceItem[] = recentSourcesRaw.map((source) => {
      const extraction = source.extractions[0]?.extractionJson as
        | { books?: unknown[] }
        | undefined;

      return {
        id: source.id,
        title: source.title || source.sourceFilename || "Untitled source",
        type: source.type,
        status: source.status,
        submittedAt: source.createdAt.toISOString(),
        extractedBookCount: extraction?.books?.length ?? 0
      };
    });

    const topTagMap = new Map<string, number>();
    const sourceTypeMap = new Map<string, number>();

    for (const book of allBooks) {
      for (const tag of book.tags || []) {
        topTagMap.set(tag, (topTagMap.get(tag) ?? 0) + 1);
      }
    }

    for (const source of sourceBreakdownRaw) {
      sourceTypeMap.set(source.type, source._count._all);
    }

    const topTags = [...topTagMap.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5);

    const sourceBreakdown = [...sourceTypeMap.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((left, right) => right.count - left.count);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const booksAddedLast7Days = allBooks.filter((book) => {
      if (!book.submittedAt) {
        return false;
      }

      return new Date(book.submittedAt) >= sevenDaysAgo;
    }).length;

    const suggestedPrompts = buildSuggestedPromptsFromTags(topTags);
    const attentionItems = buildAttentionItems(recentBooks, recentSources);

    return {
      userName: user?.name,
      privateBookCount,
      sourceCount,
      latestSourceDate: recentSources[0]?.submittedAt ?? null,
      recentSources,
      recentBooks,
      topTags,
      sourceBreakdown,
      booksAddedLast7Days,
      suggestedPrompts,
      attentionItems,
      guidance: buildGuidance({
        privateBookCount,
        sourceCount,
        topTags,
        recentSources
      })
    };
  } catch {
    return {
      userName: null,
      privateBookCount: 0,
      sourceCount: 0,
      latestSourceDate: null,
      recentSources: [],
      recentBooks: [],
      topTags: [],
      sourceBreakdown: [],
      booksAddedLast7Days: 0,
      suggestedPrompts: [{ label: "General", prompt: "What should I read next from my library?" }],
      attentionItems: [],
      guidance: "Start by importing an email, web link, or markdown note to build your private library."
    };
  }
}
