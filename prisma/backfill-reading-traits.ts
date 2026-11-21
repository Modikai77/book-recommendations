import { prisma } from "@/lib/prisma";
import { enrichBookSummaries } from "@/lib/source-processing";
import type { BookReadingTraits } from "@/lib/types";

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY before enriching the catalogue.");
  let cursor: string | undefined;
  let updated = 0;
  let unresolved = 0;
  while (true) {
    const books = await prisma.book.findMany({
      orderBy: { id: "asc" }, take: 8, where: { id: { gt: cursor } }, include: { metadata: true }
    });
    if (!books.length) break;
    cursor = books[books.length - 1].id;
    const pending = books.filter(book => !(book.metadata?.readingTraits as BookReadingTraits | null)?.premise);
    if (!pending.length) continue;
    const enriched = await enrichBookSummaries({
      parsedText: "", books: pending.map(book => ({
        title: book.title, author: book.author,
        snippet: book.metadata?.summary ?? book.canonicalSummary ?? undefined
      }))
    });
    for (const [index, book] of pending.entries()) {
      const traits = enriched[index]?.readingTraits;
      if (!traits?.premise) { unresolved++; continue; }
      const readingTraits = { ...traits, ...(book.metadata?.readingTraits as BookReadingTraits | null) };
      if (book.metadata) {
        const result = await prisma.bookMetadata.updateMany({
          where: { bookId: book.id, updatedAt: book.metadata.updatedAt }, data: { readingTraits }
        });
        updated += result.count;
        unresolved += 1 - result.count;
      } else {
        const result = await prisma.bookMetadata.createMany({ data: [{ bookId: book.id, readingTraits }], skipDuplicates: true });
        updated += result.count;
        unresolved += 1 - result.count;
      }
    }
  }
  console.log(`Enriched ${updated} books. Pending retry: ${unresolved}.`);
  if (unresolved) process.exitCode = 1;
}
main().catch(() => { console.error("Catalogue enrichment could not complete."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
