import { InteractionType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSessionUser } from "@/lib/session-user";

const readLogSchema = z.object({
  comment: z.string().nullable().optional(),
  readAt: z.string().date().nullable().optional(),
  ratingOutOf10: z.number().int().min(1).max(10).nullable().optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionResult = await getRequiredSessionUser();
  if ("error" in sessionResult) {
    return sessionResult.error;
  }

  const { id } = await params;
  const parsed = readLogSchema.safeParse(await request.json().catch(() => null));
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

  const userId = sessionResult.user.id;
  const where = { userId_bookId: { userId, bookId: id } };
  const comment = parsed.data.comment === undefined ? undefined : parsed.data.comment?.trim() || null;
  const rating = parsed.data.ratingOutOf10;
  const readLog = await prisma.$transaction(async tx => {
    const previous = await tx.readBookLog.findUnique({ where, select: { ratingOutOf10: true } });
    const saved = await tx.readBookLog.upsert({
      where,
      update: { readAt: parsed.data.readAt === undefined ? undefined : readAt, ratingOutOf10: rating, comment },
      create: { userId, bookId: id, readAt, ratingOutOf10: rating, comment }
    });
    if (!previous || previous.ratingOutOf10 !== saved.ratingOutOf10) {
      await tx.userBookInteraction.create({
        data: { userId, bookId: id, interactionType: InteractionType.MARKED_READ,
          strength: saved.ratingOutOf10 ? saved.ratingOutOf10 / 2 : 1 }
      });
    }
    return saved;
  });

  return NextResponse.json(
    {
      readLog: {
        isRead: true,
        comment: readLog.comment,
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
