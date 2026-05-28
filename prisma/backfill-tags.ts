import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enrichBookTags } from "@/lib/source-processing";
import { slugify } from "@/lib/utils";
import type { ExtractedBookCandidate } from "@/lib/types";

type UntaggedBook = Prisma.BookGetPayload<{
  include: {
    metadata: {
      select: {
        summary: true;
        shortSummary: true;
      };
    };
    tags: {
      select: {
        id: true;
      };
    };
    mentions: {
      include: {
        source: {
          select: {
            id: true;
            title: true;
            type: true;
            createdAt: true;
            submittedByUserId: true;
          };
        };
      };
    };
  };
}>;

const batchSize = Number(process.env.BACKFILL_TAG_BATCH_SIZE ?? 20);
const sourceType = process.env.BACKFILL_TAG_SOURCE_TYPE;
const sourceTitle = process.env.BACKFILL_TAG_SOURCE_TITLE;
const submittedByUserId = process.env.BACKFILL_TAG_USER_ID;

function matchesOptionalFilters(book: UntaggedBook) {
  if (!sourceType && !sourceTitle && !submittedByUserId) {
    return true;
  }

  return book.mentions.some((mention) => {
    const source = mention.source;
    return (
      (!sourceType || source.type === sourceType) &&
      (!sourceTitle || source.title?.toLowerCase().includes(sourceTitle.toLowerCase())) &&
      (!submittedByUserId || source.submittedByUserId === submittedByUserId)
    );
  });
}

async function saveBookTags(bookId: string, tags: string[]) {
  for (const rawTag of tags) {
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
          bookId,
          tagId: tag.id,
          source: "llm"
        }
      },
      update: {
        score: 0.7
      },
      create: {
        bookId,
        tagId: tag.id,
        source: "llm",
        score: 0.7
      }
    });
  }
}

async function main() {
  const untaggedBooks = (await prisma.book.findMany({
    where: {
      tags: {
        none: {}
      },
      mentions: {
        some: {}
      }
    },
    include: {
      metadata: {
        select: {
          summary: true,
          shortSummary: true
        }
      },
      tags: {
        select: {
          id: true
        }
      },
      mentions: {
        include: {
          source: {
            select: {
              id: true,
              title: true,
              type: true,
              createdAt: true,
              submittedByUserId: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  })).filter(matchesOptionalFilters);

  console.log(`Found ${untaggedBooks.length} untagged books`);

  for (let index = 0; index < untaggedBooks.length; index += batchSize) {
    const batch = untaggedBooks.slice(index, index + batchSize);
    const candidates: ExtractedBookCandidate[] = batch.map((book) => ({
      title: book.title,
      author: book.author,
      bookSummary: book.metadata?.summary || book.metadata?.shortSummary || book.canonicalSummary || undefined,
      rationale: book.mentions[0]?.mentionSummary || undefined,
      snippet: book.mentions[0]?.mentionContext || undefined
    }));

    const taggedBooks = await enrichBookTags(candidates);

    for (let batchIndex = 0; batchIndex < batch.length; batchIndex += 1) {
      const book = batch[batchIndex];
      const tags = taggedBooks[batchIndex]?.tags ?? [];
      await saveBookTags(book.id, tags);
      console.log(`Tagged ${book.title}`, { tags });
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
