import { createHash } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { forwardingOwner, validResendSignature } from "@/lib/inbound-address";
import { newsletterText, processInbound } from "@/lib/inbound-import";

export const maxDuration = 300;

const received = z.object({ email_id: z.uuid(), to: z.array(z.string()), cc: z.array(z.string()).optional(),
  bcc: z.array(z.string()).optional(), subject: z.string().optional() });

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const addressSecret = process.env.NEXTAUTH_SECRET;
  const key = process.env.RESEND_API_KEY;
  if (!secret || !addressSecret || !key) return new Response(null, { status: 503 });
  const raw = await request.text();
  if (!validResendSignature(raw, request.headers, secret)) return new Response(null, { status: 401 });
  const event = JSON.parse(raw);
  if (event.type !== "email.received") return new Response(null, { status: 204 });
  const payload = received.parse(event.data);
  const recipients = [...payload.to, ...payload.cc ?? [], ...payload.bcc ?? []];
  const owners = [...new Set(recipients.map(address => forwardingOwner(address, addressSecret)).filter((id): id is string => !!id))];
  if (!owners.length) return new Response(null, { status: 204 });
  const users = await prisma.user.findMany({ where: { id: { in: owners } }, select: { id: true } });
  let body: string | undefined;
  for (const user of users) {
    const digest = createHash("sha256").update(user.id + ":" + payload.email_id).digest("hex");
    const id = "resend_" + digest;
    const existing = await prisma.source.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      if (body === undefined) {
        const response = await fetch("https://api.resend.com/emails/receiving/" + payload.email_id, {
          headers: { Authorization: "Bearer " + key }, cache: "no-store", signal: AbortSignal.timeout(20000)
        });
        if (!response.ok) return new Response(null, { status: 503 });
        body = newsletterText(await response.json());
      }
      await prisma.source.upsert({ where: { id }, update: {}, create: {
        id, submittedByUserId: user.id, type: "EMAIL", title: payload.subject || "Forwarded email",
        rawText: body, parsedText: body, visibility: "PRIVATE", status: "SUBMITTED"
      } });
    }
    after(() => processInbound(id, user.id));
  }
  return new Response(null, { status: 204 });
}
