import { InteractionType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const interactionSchema = z.object({
  interactionType: z.enum(["VIEWED", "SAVED", "LIKED", "DISLIKED", "MARKED_READ", "RECOMMENDED_CLICKED"]),
  strength: z.number().min(0).max(5).optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = interactionSchema.parse(await request.json());

  const interaction = await prisma.userBookInteraction.create({
    data: {
      userId: process.env.DEMO_USER_ID ?? "demo-user",
      bookId: id,
      interactionType: payload.interactionType as InteractionType,
      strength: payload.strength ?? 1
    }
  });

  return NextResponse.json({ interactionId: interaction.id }, { status: 201 });
}
