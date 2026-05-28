import { describe, expect, it } from "vitest";
import { setDateInputYear, sortReadLogBooks, todayDateInputValue } from "@/lib/read-log";
import type { BookRecord } from "@/lib/types";

const books: BookRecord[] = [
  {
    id: "book-a",
    title: "Beta",
    author: "Author Two",
    readLog: {
      isRead: true,
      readAt: "2024-01-01T12:00:00.000Z",
      ratingOutOf10: 6,
      markedAt: "2026-01-01T12:00:00.000Z"
    }
  },
  {
    id: "book-b",
    title: "Alpha",
    author: "Author One",
    readLog: {
      isRead: true,
      readAt: null,
      ratingOutOf10: 9,
      markedAt: "2026-02-01T12:00:00.000Z"
    }
  },
  {
    id: "book-c",
    title: "Gamma",
    author: "Author Three",
    readLog: {
      isRead: true,
      readAt: "2025-01-01T12:00:00.000Z",
      ratingOutOf10: null,
      markedAt: "2026-03-01T12:00:00.000Z"
    }
  }
];

describe("read log helpers", () => {
  it("sorts read books alphabetically", () => {
    expect(sortReadLogBooks(books, "titleAsc").map((book) => book.title)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("sorts by read date while keeping no-date books last by default", () => {
    expect(sortReadLogBooks(books, "readAtDesc").map((book) => book.title)).toEqual(["Gamma", "Beta", "Alpha"]);
  });

  it("can put no-date books first", () => {
    expect(sortReadLogBooks(books, "noDateFirst").map((book) => book.title)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("sorts by marks with unscored books last", () => {
    expect(sortReadLogBooks(books, "ratingDesc").map((book) => book.title)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("updates just the year of a date input value", () => {
    expect(setDateInputYear("2026-05-22", 2016)).toBe("2016-05-22");
  });

  it("formats a local date for date inputs", () => {
    expect(todayDateInputValue(new Date(2026, 4, 22))).toBe("2026-05-22");
  });
});
