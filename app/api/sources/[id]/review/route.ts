import { ReviewDecision, SourceStatus, SourceVisibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "MERGED"]),
  notes: z.string().optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = reviewSchema.parse(await request.json());

  const review = await prisma.adminReview.create({
    data: {
      sourceId: id,
      reviewerUserId: process.env.DEMO_ADMIN_ID ?? process.env.DEMO_USER_ID ?? "demo-admin",
      decision: payload.decision as ReviewDecision,
      notes: payload.notes
    }
  });

  await prisma.source.update({
    where: { id },
    data: {
      status: payload.decision === "REJECTED" ? SourceStatus.REJECTED : SourceStatus.APPROVED,
      visibility: payload.decision === "REJECTED" ? SourceVisibility.REJECTED : SourceVisibility.APPROVED_SHARED
    }
  });

  return NextResponse.json({ reviewId: review.id });
}
