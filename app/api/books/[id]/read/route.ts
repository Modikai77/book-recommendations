import { InteractionType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSessionUser } from "@/lib/session-user";

const readLogSchema = z.object({
  readAt: z.string().date().nullable().optional(),
  ratingOutOf10: z.number().int().min(1).max(10).nullable().optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionResult = await getRequiredSessionUser();
  if ("error" in sessionResult) {
    return sessionResult.error;
  }

  const { id } = await params;
  const parsed = readLogSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid read details" }, { status: 400 });
  }

  const book = await prisma.book.findFirst({
    where: {
      id,
      OR: [
        { catalogStatus: "SHARED" },
        {
          mentions: {
            some: {
              source: {
                submittedByUserId: sessionResult.user.id
              }
            }
          }
        }
      ]
    },
    select: { id: true }
  });

  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const readAt = parsed.data.readAt ? new Date(`${parsed.data.readAt}T12:00:00.000Z`) : null;

  const readLog = await prisma.readBookLog.upsert({
    where: {
      userId_bookId: {
        userId: sessionResult.user.id,
        bookId: id
      }
    },
    update: {
      readAt,
      ratingOutOf10: parsed.data.ratingOutOf10 ?? null
    },
    create: {
      userId: sessionResult.user.id,
      bookId: id,
      readAt,
      ratingOutOf10: parsed.data.ratingOutOf10 ?? null
    }
  });

  await prisma.userBookInteraction.create({
    data: {
      userId: sessionResult.user.id,
      bookId: id,
      interactionType: InteractionType.MARKED_READ,
      strength: parsed.data.ratingOutOf10 ? parsed.data.ratingOutOf10 / 2 : 1
    }
  });

  return NextResponse.json(
    {
      readLog: {
        isRead: true,
        readAt: readLog.readAt?.toISOString() ?? null,
        ratingOutOf10: readLog.ratingOutOf10,
        markedAt: readLog.createdAt.toISOString()
      }
    },
    { status: 201 }
  );
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionResult = await getRequiredSessionUser();
  if ("error" in sessionResult) {
    return sessionResult.error;
  }

  const { id } = await params;

  await prisma.readBookLog.deleteMany({
    where: {
      userId: sessionResult.user.id,
      bookId: id
    }
  });

  return NextResponse.json({ readLog: null });
}
