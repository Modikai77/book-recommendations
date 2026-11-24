import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSessionUser } from "@/lib/session-user";
import { dispatchImport } from "@/lib/web-import";

const input = z.object({ url: z.url({ protocol: /^https?$/ }), title: z.string().optional(),
  rawText: z.string().optional() });

export async function POST(request: Request) {
  const auth = await getRequiredSessionUser();
  if (!auth.user) return auth.error;
  const id = z.uuid().safeParse(request.headers.get("X-Submission-Id"));
  const body = input.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return NextResponse.json({ error: "Enter a valid article URL." }, { status: 400 });
  // Include the owner in the lookup before exposing or dispatching an existing job.
  const source = await prisma.source.upsert({ where: { id: id.data }, update: {}, create: {
    id: id.data, type: "WEB_LINK", sourceUrl: body.data.url, submittedByUserId: auth.user.id,
    title: body.data.title, rawText: body.data.rawText ?? "", webImport: { create: {} }
  }, include: { webImport: true } });
  if (source.submittedByUserId !== auth.user.id || source.sourceUrl !== body.data.url || !source.webImport)
    return NextResponse.json({ error: "Import reference already in use." }, { status: 409 });
  if (!source.webImport.error && source.webImport.stage !== "done") {
    try {
      await dispatchImport(source.webImport);
    } catch {
      await prisma.webImport.updateMany({ where: { sourceId: source.id, revision: source.webImport.revision },
        data: { error: "The queue is unavailable. Resume this saved import to try again." } });
      return NextResponse.json({ sourceId: source.id, error: "Import saved, but the queue is unavailable. Use Resume import below." }, { status: 503 });
    }
  }
  return NextResponse.json({ sourceId: source.id, status: "accepted" }, { status: 202 });
}

export async function GET() {
  const auth = await getRequiredSessionUser();
  if (!auth.user) return auth.error;
  const owned = { source: { submittedByUserId: auth.user.id } };
  const select = { sourceId: true, stage: true, error: true, bookCount: true, revision: true, updatedAt: true,
    source: { select: { title: true, sourceUrl: true } } } as const;
  const [active, recent] = await Promise.all([
    prisma.webImport.findMany({ where: { ...owned, stage: { not: "done" } }, select, orderBy: { updatedAt: "desc" } }),
    prisma.webImport.findMany({ where: { ...owned, stage: "done" }, select, orderBy: { updatedAt: "desc" }, take: 5 })
  ]);
  return NextResponse.json([...active, ...recent], { headers: { "Cache-Control": "private, no-store" } });
}
