import bcrypt from "bcryptjs";
import { CatalogStatus, ListSystemType, SourceStatus, SourceType, SourceVisibility, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

async function main() {
  const adminPassword = await bcrypt.hash("password123", 12);
  const userPassword = await bcrypt.hash("password123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin",
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      profile: { create: { onboardingComplete: true } }
    }
  });

  const user = await prisma.user.upsert({
    where: { email: "reader@example.com" },
    update: {},
    create: {
      email: "reader@example.com",
      name: "Reader",
      passwordHash: userPassword,
      role: UserRole.USER,
      profile: {
        create: {
          onboardingComplete: true,
          tasteSummary: "Prefers short reflective literary fiction."
        }
      }
    }
  });

  const books = await Promise.all([
    prisma.book.upsert({
      where: { title_author: { title: "Small Things Like These", author: "Claire Keegan" } },
      update: {},
      create: {
        title: "Small Things Like These",
        author: "Claire Keegan",
        canonicalSummary: "A short novel about conscience, family life, and quiet heroism.",
        catalogStatus: CatalogStatus.SHARED,
        metadata: {
          create: {
            summary: "A quiet Christmas-season novel set in a small Irish town.",
            shortSummary: "Short literary fiction with emotional weight.",
            readingTraits: {
              genre: ["fiction", "literary fiction"],
              tone: ["quiet", "reflective", "tender"],
              length: "short",
              pace: "moderate"
            }
          }
        }
      }
    }),
    prisma.book.upsert({
      where: { title_author: { title: "The Summer Book", author: "Tove Jansson" } },
      update: {},
      create: {
        title: "The Summer Book",
        author: "Tove Jansson",
        canonicalSummary: "An elegant short novel about island life and family.",
        catalogStatus: CatalogStatus.SHARED,
        metadata: {
          create: {
            summary: "A tender, concise novel about a girl and her grandmother on a remote island.",
            shortSummary: "Contemplative fiction with warmth and nature.",
            readingTraits: {
              genre: ["fiction"],
              tone: ["gentle", "contemplative"],
              length: "short",
              pace: "slow"
            }
          }
        }
      }
    })
  ]);

  const fictionTag = await prisma.tag.upsert({
    where: { slug: "fiction" },
    update: {},
    create: { slug: "fiction", label: "fiction", category: "genre" }
  });

  await Promise.all(
    books.map((book) =>
      prisma.bookTag.upsert({
        where: {
          bookId_tagId_source: {
            bookId: book.id,
            tagId: fictionTag.id,
            source: "seed"
          }
        },
        update: {},
        create: {
          bookId: book.id,
          tagId: fictionTag.id,
          source: "seed",
          score: 0.9
        }
      })
    )
  );

  const source = await prisma.source.create({
    data: {
      submittedByUserId: user.id,
      type: SourceType.MARKDOWN,
      visibility: SourceVisibility.PRIVATE,
      status: SourceStatus.NEEDS_REVIEW,
      title: "spring-reading.md",
      sourceFilename: "spring-reading.md",
      rawText: "# Spring reading\n- Small Things Like These by Claire Keegan",
      parsedText: "Spring reading Small Things Like These by Claire Keegan"
    }
  });

  await prisma.recommendationMention.create({
    data: {
      sourceId: source.id,
      bookId: books[0].id,
      recommendedBy: "Obsidian note",
      mentionContext: "Spring reading"
    }
  });

  await prisma.list.upsert({
    where: {
      id: "saved-list"
    },
    update: {},
    create: {
      id: "saved-list",
      userId: user.id,
      name: "Saved",
      systemType: ListSystemType.SAVED
    }
  });

  console.log("Seed complete", { adminId: admin.id, userId: user.id });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
