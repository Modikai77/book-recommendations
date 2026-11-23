import { createHmac, timingSafeEqual } from "node:crypto";

const domain = "miroeta.resend.app";

export function forwardingAddress(userId: string, secret: string) {
  const tag = createHmac("sha256", secret).update("forward-email:" + userId).digest("hex").slice(0, 32);
  return `${userId}.${tag}@${domain}`;
}

export function forwardingOwner(recipient: string, secret: string) {
  const address = (recipient.match(/<([^<>]+)>/)?.[1] ?? recipient).trim().toLowerCase();
  const match = /^([a-z0-9]{1,31})\.[a-f0-9]{32}@miroeta\.resend\.app$/.exec(address);
  if (!match) return null;
  return timingSafeEqual(Buffer.from(address), Buffer.from(forwardingAddress(match[1], secret))) ? match[1] : null;
}

export function validResendSignature(body: string, headers: Headers, secret: string) {
  const id = headers.get("svix-id");
  const time = headers.get("svix-timestamp") ?? "";
  if (!id || !/^\d+$/.test(time) || Math.abs(Date.now() / 1000 - Number(time)) > 300) return false;
  const expected = createHmac("sha256", Buffer.from(secret.replace(/^whsec_/, ""), "base64"))
    .update(`${id}.${time}.${body}`).digest("base64");
  return (headers.get("svix-signature") ?? "").split(" ").some(signature => {
    const actual = Buffer.from(signature);
    const wanted = Buffer.from("v1," + expected);
    return actual.length === wanted.length && timingSafeEqual(actual, wanted);
  });
}
