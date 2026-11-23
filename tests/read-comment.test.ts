import { beforeEach, expect, it, vi } from "vitest";

type Details = { readAt?: Date | null; comment?: string | null; ratingOutOf10?: number | null };
const db = vi.hoisted(() => ({
  book: { findFirst: vi.fn() },
  readBookLog: { findUnique: vi.fn(), upsert: vi.fn() },
  userBookInteraction: { create: vi.fn() },
  $transaction: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/session-user", () => ({
  getRequiredSessionUser: async () => ({ user: { id: "reader" } })
}));
import { POST } from "@/app/api/books/[id]/read/route";

beforeEach(() => {
  vi.resetAllMocks();
  db.book.findFirst.mockResolvedValue({ id: "book" });
  db.$transaction.mockImplementation(fn => fn(db));
});

async function save(body: object) {
  const response = await POST(new Request("http://localhost/api/books/book/read", {
    method: "POST", body: JSON.stringify(body)
  }), { params: Promise.resolve({ id: "book" }) });
  return (await response!.json()).readLog;
}

it("creates, edits and clears a personal comment without recording extra reads", async () => {
  let stored: Details | null = null;
  db.readBookLog.findUnique.mockImplementation(() => stored);
  db.readBookLog.upsert.mockImplementation(({ where, create, update }) => {
    expect(where.userId_bookId).toEqual({ userId: "reader", bookId: "book" });
    stored = stored ? { ...stored, ...Object.fromEntries(Object.entries(update).filter(([, v]) => v !== undefined)) } : create;
    return { ...stored, createdAt: new Date() };
  });
  expect(await save({ comment: "First impression", ratingOutOf10: 8 })).toMatchObject({ comment: "First impression", readAt: null });
  expect(await save({ comment: "On reflection\nI liked the ending." })).toMatchObject({ comment: "On reflection\nI liked the ending.", ratingOutOf10: 8, readAt: null });
  expect(await save({ ratingOutOf10: 8 })).toMatchObject({ comment: "On reflection\nI liked the ending." });
  expect(await save({ comment: "" })).toMatchObject({ comment: null, ratingOutOf10: 8 });
  expect(db.userBookInteraction.create).toHaveBeenCalledTimes(1);
});
