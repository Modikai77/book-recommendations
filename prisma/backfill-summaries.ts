import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enrichBookEmbeddings, enrichBookSummaries } from "@/lib/source-processing";
import type { ExtractedBookCandidate } from "@/lib/types";

type PendingBook = Prisma.BookGetPayload<{
  include: {
    metadata: {
      select: {
        summary: true;
        shortSummary: true;
        embedding: true;
      };
    };
    mentions: {
      include: {
        source: {
          select: {
            id: true;
            title: true;
            parsedText: true;
            rawText: true;
          };
        };
      };
    };
  };
}>;

const pendingBooksArgs = Prisma.validator<Prisma.BookFindManyArgs>()({
  where: {
    OR: [
      { canonicalSummary: null },
      { metadata: { is: null } },
      { metadata: { is: { summary: null } } },
      { metadata: { is: { shortSummary: null } } }
    ]
  },
  include: {
    metadata: {
      select: {
        summary: true,
        shortSummary: true,
        embedding: true
      }
    },
    mentions: {
      include: {
        source: {
          select: {
            id: true,
            title: true,
            parsedText: true,
            rawText: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    }
  }
});

function needsSummary(book: PendingBook) {
  return !book.metadata?.summary && !book.metadata?.shortSummary && !book.canonicalSummary;
}

async function updateBook(bookId: string, candidate: ExtractedBookCandidate) {
  const summary = candidate.bookSummary || candidate.rationale || candidate.snippet || undefined;

  await prisma.book.update({
    where: { id: bookId },
    data: {
      canonicalSummary: summary
    }
  });

  await prisma.bookMetadata.upsert({
    where: { bookId },
    update: {
      summary,
      shortSummary: summary,
      embedding: candidate.embedding ?? undefined
    },
    create: {
      bookId,
      summary,
      shortSummary: summary,
      embedding: candidate.embedding ?? undefined
    }
  });
}

async function processGroup(sourceId: string | null, books: PendingBook[]) {
  const source = books[0]?.mentions[0]?.source;
  const parsedText = source?.parsedText || source?.rawText || "";
  const recommender = books[0]?.mentions[0]?.recommendedBy || undefined;

  let candidates: ExtractedBookCandidate[] = books.map((book) => ({
    title: book.title,
    author: book.author,
    bookSummary: book.metadata?.summary || book.metadata?.shortSummary || book.canonicalSummary || undefined,
    rationale: book.mentions[0]?.mentionSummary || undefined,
    snippet: book.mentions[0]?.mentionContext || undefined
  }));

  const hasAnyMissingSummary = books.some(needsSummary);

  if (hasAnyMissingSummary) {
    candidates = await enrichBookSummaries({
      parsedText,
      sourceTitle: source?.title || undefined,
      recommender,
      books: candidates
    });
  }

  candidates = await enrichBookEmbeddings(candidates);

  for (let index = 0; index < books.length; index += 1) {
    await updateBook(books[index].id, candidates[index]);
  }

  console.log(`Processed ${books.length} books`, { sourceId: sourceId ?? "no-source" });
}

async function main() {
  const books: PendingBook[] = await prisma.book.findMany(pendingBooksArgs);

  if (!books.length) {
    console.log("No books need summary backfill.");
    return;
  }

  const grouped = new Map<string, PendingBook[]>();

  for (const book of books) {
    const sourceId = book.mentions[0]?.source.id ?? `book:${book.id}`;
    const existing = grouped.get(sourceId) ?? [];
    existing.push(book);
    grouped.set(sourceId, existing);
  }

  for (const [sourceId, groupedBooks] of grouped) {
    await processGroup(sourceId.startsWith("book:") ? null : sourceId, groupedBooks);
  }

  console.log(`Backfilled ${books.length} books.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
