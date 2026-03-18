import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const itemSchema = z.object({
  bookId: z.string(),
  notes: z.string().optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = itemSchema.parse(await request.json());

  const item = await prisma.listItem.create({
    data: {
      listId: id,
      bookId: payload.bookId,
      notes: payload.notes
    }
  });

  return NextResponse.json({ itemId: item.id }, { status: 201 });
}
