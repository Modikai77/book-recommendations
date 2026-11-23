import { NextResponse } from "next/server";
import { z } from "zod";
import { getTasteProfile, listBooksForUser } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { recommendBooks } from "@/lib/recommendations";
import { getRequiredSessionUser } from "@/lib/session-user";

const querySchema = z.object({
  query: z.string().trim().min(2).max(4000),
  includePrivate: z.boolean().optional()
});

export async function POST(request: Request) {
  const sessionResult = await getRequiredSessionUser();
  if ("error" in sessionResult) {
    return sessionResult.error;
  }

  const parsed = querySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a request between 2 and 4,000 characters." }, { status: 400 });
  const payload = parsed.data;
  const userId = sessionResult.user.id;
  let recommendation: Awaited<ReturnType<typeof recommendBooks>>;
  try {
    const [books, taste] = await Promise.all([
      listBooksForUser(payload.includePrivate ? userId : undefined, { requireCatalogue: true }),
      getTasteProfile(userId)
    ]);
    recommendation = await recommendBooks(payload.query, books, taste);
  } catch {
    return NextResponse.json({ error: "Marginalia couldn’t check your catalogue. Please try again." }, { status: 503 });
  }
  const { intent: parsedQuery, results: ranked } = recommendation;

  try {
    const query = await prisma.recommendationQuery.create({
      data: {
        userId,
        rawQuery: payload.query,
        interpretedQueryJson: parsedQuery
      }
    });

    if (ranked.length) {
      await prisma.recommendationResult.createMany({
        data: ranked.map((result, index) => ({
          queryId: query.id,
          bookId: result.book.id,
          rank: index + 1,
          score: result.score,
          reasonJson: result.reason
        }))
      });
    }
  } catch {
    // The API remains usable without a configured database.
  }

  return NextResponse.json({
    intent: parsedQuery,
    results: ranked.map((result) => ({
      book: {
        id: result.book.id,
        title: result.book.title,
        author: result.book.author,
        sourceTitle: result.book.sourceTitle,
        editableSourceId: result.book.editableSourceId,
        summary:
          result.book.metadata?.shortSummary || result.book.metadata?.summary || result.book.canonicalSummary || null
      },
      score: result.score,
      reason: result.reason,
      parsedQuery
    }))
  });
}
