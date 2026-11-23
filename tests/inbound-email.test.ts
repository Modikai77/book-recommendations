import { createHmac } from "node:crypto";
import { expect, it } from "vitest";
import { forwardingAddress, forwardingOwner, validResendSignature } from "@/lib/inbound-address";
import { newsletterText } from "@/lib/inbound-import";

it("routes only authentic per-user addresses on the receiving domain", () => {
  const address = forwardingAddress("reader123", "test");
  expect(forwardingOwner("Marginalia <" + address + ">", "test")).toBe("reader123");
  expect(forwardingOwner(address.replace("reader123", "other"), "test")).toBeNull();
  expect(forwardingOwner(address + ".example.com", "test")).toBeNull();
});

it("verifies the exact signed payload and rejects stale delivery signatures", () => {
  const time = String(Math.floor(Date.now() / 1000));
  const headers = new Headers({ "svix-id": "id", "svix-timestamp": time,
    "svix-signature": "v1," + createHmac("sha256", "test").update("id." + time + ".{}").digest("base64") });
  const secret = "whsec_" + Buffer.from("test").toString("base64");
  expect(validResendSignature("{}", headers, secret)).toBe(true);
  expect(validResendSignature("{ }", headers, secret)).toBe(false);
  headers.set("svix-timestamp", "1");
  expect(validResendSignature("{}", headers, secret)).toBe(false);
});

it("keeps quoted newsletter text and handles HTML-only forwards", () => {
  expect(newsletterText({ text: "From: Reader\n> Good book" })).toContain("> Good book");
  expect(newsletterText({ html: "<p>A &amp; B<br>by Alice</p><script>skip()</script>" })).toBe("A & B\nby Alice");
});
