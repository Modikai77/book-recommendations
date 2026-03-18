import { NextResponse } from "next/server";
import { z } from "zod";
import { getTasteProfile, listBooksForUser } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { rankRecommendations } from "@/lib/recommendations";

const querySchema = z.object({
  query: z.string().min(2),
  includePrivate: z.boolean().optional()
});

export async function POST(request: Request) {
  const payload = querySchema.parse(await request.json());
  const userId = process.env.DEMO_USER_ID ?? "demo-user";
  const books = await listBooksForUser(payload.includePrivate ? userId : undefined);
  const tasteProfile = await getTasteProfile(userId);
  const ranked = rankRecommendations(books, payload.query, tasteProfile);

  try {
    const query = await prisma.recommendationQuery.create({
      data: {
        userId,
        rawQuery: payload.query,
        interpretedQueryJson: ranked[0]?.parsedQuery ?? { query: payload.query }
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
    results: ranked.map((result) => ({
      book: {
        id: result.book.id,
        title: result.book.title,
        author: result.book.author,
        summary:
          result.book.metadata?.shortSummary || result.book.metadata?.summary || result.book.canonicalSummary || null
      },
      score: result.score,
      reason: result.reason,
      parsedQuery: result.parsedQuery
    }))
  });
}
