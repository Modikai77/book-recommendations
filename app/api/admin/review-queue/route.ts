import { getRequiredSessionUser } from "@/lib/session-user";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await getRequiredSessionUser();
  if (!auth.user) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sources = await prisma.source.findMany({
    where: {
      status: "NEEDS_REVIEW"
    },
    include: {
      extractions: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ sources });
}
