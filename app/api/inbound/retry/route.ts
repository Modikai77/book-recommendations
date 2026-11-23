import { after } from "next/server";
import { getRequiredSessionUser } from "@/lib/session-user";
import { processInbound } from "@/lib/inbound-import";

export const maxDuration = 300;
export async function POST(request: Request) {
  const session = await getRequiredSessionUser();
  if (!session.user) return session.error;
  const id = (await request.formData()).get("source");
  if (typeof id !== "string" || !/^resend_[a-f0-9]{64}$/.test(id)) return new Response(null, { status: 400 });
  const userId = session.user.id;
  after(() => processInbound(id, userId));
  return Response.redirect(new URL("/dashboard", request.url), 303);
}
