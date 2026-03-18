import { ReviewDecision, SourceStatus, SourceVisibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSessionUser } from "@/lib/session-user";

const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "MERGED"]),
  notes: z.string().optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionResult = await getRequiredSessionUser();
  if ("error" in sessionResult) {
    return sessionResult.error;
  }

  if (sessionResult.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const payload = reviewSchema.parse(await request.json());

  const review = await prisma.adminReview.create({
    data: {
      sourceId: id,
      reviewerUserId: sessionResult.user.id,
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
