import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSessionUser } from "@/lib/session-user";
import { dispatchImport } from "@/lib/web-import";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getRequiredSessionUser();
  if (!auth.user) return auth.error;
  const { id } = await context.params;
  const job = await prisma.webImport.findFirst({ where: { sourceId: id, source: { submittedByUserId: auth.user.id } } });
  if (!job) return NextResponse.json({ error: "Import unavailable" }, { status: 404 });
  if (job.stage === "done") return new Response(null, { status: 204 });
  if (job.error || job.updatedAt.getTime() < Date.now() - 360_000) {
    const resumed = await prisma.webImport.updateMany({ where: { sourceId: id, revision: job.revision },
      data: { error: null, revision: { increment: 1 } } });
    if (resumed.count) {
      const message = { sourceId: id, revision: job.revision + 1 };
      try {
        await dispatchImport(message);
      } catch {
        await prisma.webImport.updateMany({ where: message, data: { error: "The queue is unavailable. Try resuming again." } });
        return NextResponse.json({ error: "Queue unavailable" }, { status: 503 });
      }
    }
  }
  return new Response(null, { status: 204 });
}
