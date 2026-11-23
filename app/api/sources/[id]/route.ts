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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to rename a source." }, { status: 401 });
  const payload = await request.json().catch(() => null);
  const title = typeof payload?.title === "string" ? payload.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Enter a source name." }, { status: 400 });
  const { id } = await params;
  const updated = await prisma.source.updateMany({ where: { id, submittedByUserId: session.user.id }, data: { title } });
  if (!updated.count) return NextResponse.json({ error: "Source not found." }, { status: 404 });
  return NextResponse.json({ id, title });
}
