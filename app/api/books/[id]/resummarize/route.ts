import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSessionUser } from "@/lib/session-user";
import { regenerateSingleBookSummary } from "@/lib/source-processing";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionResult = await getRequiredSessionUser();
    if ("error" in sessionResult) {
      return sessionResult.error;
    }

    const { id } = await params;
    const book = await prisma.book.findFirst({
      where: {
        id,
        mentions: {
          some: {
            source: {
              submittedByUserId: sessionResult.user.id
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
              submittedByUserId: sessionResult.user.id
            }
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        }
      }
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const mention = book.mentions[0];
    const regenerated = await regenerateSingleBookSummary({
      title: book.title,
      author: book.author,
      parsedText: mention?.source.parsedText || mention?.source.rawText || "",
      sourceTitle: mention?.source.title || undefined,
      recommender: mention?.recommendedBy || undefined,
      snippet: mention?.mentionContext || undefined,
      rationale: mention?.mentionSummary || undefined
    });

    await prisma.book.update({
      where: { id: book.id },
      data: {
        canonicalSummary: regenerated.summary
      }
    });

    await prisma.bookMetadata.upsert({
      where: { bookId: book.id },
      update: {
        summary: regenerated.summary,
        shortSummary: regenerated.summary,
        embedding: regenerated.embedding ?? undefined
      },
      create: {
        bookId: book.id,
        summary: regenerated.summary,
        shortSummary: regenerated.summary,
        embedding: regenerated.embedding ?? undefined
      }
    });

    return NextResponse.json({
      bookId: book.id,
      summary: regenerated.summary
    });
  } catch (error) {
    console.error("Failed to regenerate summary", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown resummary error" },
      { status: 500 }
    );
  }
}
