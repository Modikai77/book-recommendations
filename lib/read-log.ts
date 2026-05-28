import type { BookReadLogRecord, BookRecord, ReadLogSort } from "@/lib/types";

export function getReadLogBooks(books: BookRecord[]) {
  return books.filter((book) => book.readLog);
}

export function sortReadLogBooks(books: BookRecord[], sort: ReadLogSort) {
  return [...books].sort((left, right) => {
    switch (sort) {
      case "titleAsc":
        return compareText(left.title, right.title);
      case "titleDesc":
        return compareText(right.title, left.title);
      case "ratingDesc":
        return compareRatingsDesc(left.readLog?.ratingOutOf10, right.readLog?.ratingOutOf10);
      case "markedAtDesc":
        return compareNullableDates(right.readLog?.markedAt, left.readLog?.markedAt);
      case "readAtAsc":
        return compareReadDates(left.readLog?.readAt, right.readLog?.readAt, "asc");
      case "noDateFirst":
        return compareReadDates(left.readLog?.readAt, right.readLog?.readAt, "noDateFirst");
      case "readAtDesc":
      default:
        return compareReadDates(left.readLog?.readAt, right.readLog?.readAt, "desc");
    }
  });
}

export function updateBookReadLog(
  books: BookRecord[],
  bookId: string,
  readLog: BookReadLogRecord | null
) {
  return books.map((book) => (book.id === bookId ? { ...book, readLog } : book));
}

export function todayDateInputValue(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

export function setDateInputYear(dateValue: string, year: number) {
  const fallback = todayDateInputValue();
  const [, month, day] = (dateValue || fallback).split("-");
  return [String(year).padStart(4, "0"), month || "01", day || "01"].join("-");
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function compareRatingsDesc(left?: number | null, right?: number | null) {
  if (left == null && right == null) {
    return 0;
  }

  if (left == null) {
    return 1;
  }

  if (right == null) {
    return -1;
  }

  return right - left;
}

function compareNullableDates(left?: string | null, right?: string | null) {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return new Date(left).getTime() - new Date(right).getTime();
}

function compareReadDates(
  left?: string | null,
  right?: string | null,
  direction: "asc" | "desc" | "noDateFirst" = "desc"
) {
  if (!left && !right) {
    return 0;
  }

  if (direction === "noDateFirst") {
    if (!left) {
      return -1;
    }

    if (!right) {
      return 1;
    }
  } else {
    if (!left) {
      return 1;
    }

    if (!right) {
      return -1;
    }
  }

  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  return direction === "asc" || direction === "noDateFirst" ? leftTime - rightTime : rightTime - leftTime;
}
