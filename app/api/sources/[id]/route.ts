import { getCurrentSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getCurrentSession();
  const source = await prisma.source.findFirst({
    where: { id, ...(session?.user?.role === "ADMIN" ? {} : { OR: [
      { visibility: "APPROVED_SHARED" },
      ...(session?.user?.id ? [{ submittedByUserId: session.user.id }] : [])
    ] }) },
    include: {
      extractions: {
        orderBy: { createdAt: "desc" }
      },
      reviews: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!source) {
    return NextResponse.json({ error: "Source not found." }, { status: 404 });
  }

  return NextResponse.json(source);
}
