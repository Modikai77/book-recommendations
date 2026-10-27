export type SubmissionResult = {
  requestId?: string;
  sourceId: string;
  status: string;
  extractedBooks?: Array<{ title: string; author: string }>;
};

export type SubmissionProgress = {
  type: "progress";
  stage: string;
  elapsedMs: number;
  bookCount?: number;
};

export type SubmissionFailure = {
  error: string;
  requestId?: string;
  canPasteText?: boolean;
  code?: string;
};

export type SubmissionEvent =
  | SubmissionProgress
  | { type: "heartbeat" }
  | { type: "result"; result: SubmissionResult }
  | ({ type: "error" } & SubmissionFailure);

export class SubmissionError extends Error {
  constructor(message: string, readonly canPasteText = false) {
    super(message);
    this.name = "SubmissionError";
  }
}

function httpFailureMessage(status: number) {
  if (status === 504) return "The import exceeded the server’s time limit. Your pasted text has been kept.";
  if (status === 413) return "The pasted article is too large. Paste just the book recommendations and try again.";
  if (status === 401) return "Your session has expired. Sign in again before importing.";
  return `The server could not complete the import (HTTP ${status}).`;
}

export async function readSubmissionResponse(
  response: Response,
  onProgress: (progress: SubmissionProgress) => void
): Promise<SubmissionResult> {
  if (!response.ok) {
    const failure = await response.json().catch(() => null) as SubmissionFailure | null;
    throw new SubmissionError(failure?.error || httpFailureMessage(response.status), failure?.canPasteText);
  }
  if (!response.headers.get("content-type")?.includes("application/x-ndjson")) {
    return await response.json() as SubmissionResult;
  }
  if (!response.body) throw new SubmissionError("The import response was empty. Your text has been kept.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let result: SubmissionResult | undefined;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as SubmissionEvent;
    if (event.type === "progress") onProgress(event);
    if (event.type === "result") result = event.result;
    if (event.type === "error") throw new SubmissionError(event.error, event.canPasteText);
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = pending.indexOf("\n")) >= 0) {
        consume(pending.slice(0, newline));
        pending = pending.slice(newline + 1);
        if (result) return result;
      }
      if (done) break;
    }
    consume(pending);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (!result) {
    throw new SubmissionError("The connection closed before completion. Check your library before retrying: the import may still be running.");
  }
  return result;
}

export function submissionProgressLabel(progress: SubmissionProgress) {
  const labels: Record<string, string> = {
    normalize: "Reading your source…",
    extract: "Finding recommended books…",
    summaries: "Writing book summaries…",
    tags: "Organizing books…",
    embeddings: "Preparing library search…",
    save_source: "Saving to your library…",
    save_extraction: "Saving to your library…",
    save_books: "Saving books…"
  };
  const count = progress.bookCount === undefined ? "" : ` ${progress.bookCount} books found.`;
  return `${labels[progress.stage] ?? "Importing…"}${count}`;
}
