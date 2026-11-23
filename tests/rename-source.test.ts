import { expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ source: { updateMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ getCurrentSession: async () => ({ user: { id: "reader" } }) }));
import { PATCH } from "@/app/api/sources/[id]/route";

it("renames only the source with the matching import ID and owner", async () => {
  db.source.updateMany.mockResolvedValue({ count: 1 });
  const request = new Request("https://example.test", { method: "PATCH", body: JSON.stringify({ title: "  Tyler Cowen: Best non-fiction books of 2026  " }) });
  const response = await PATCH(request, { params: Promise.resolve({ id: "one-of-two-same-subjects" }) });
  expect(response.status).toBe(200);
  expect(db.source.updateMany).toHaveBeenCalledWith({
    where: { id: "one-of-two-same-subjects", submittedByUserId: "reader" },
    data: { title: "Tyler Cowen: Best non-fiction books of 2026" }
  });
});
