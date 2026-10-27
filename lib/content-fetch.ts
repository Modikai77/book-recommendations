// Logs deliberately omit URL credentials, query strings, headers and response bodies.
function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return "[invalid URL]";
  }
}

function redactDiagnostic(value: string) {
  return value
    .replace(/[a-z][a-z0-9+.-]*:\/\/[^\s<>"']+/gi, (url) => safeUrl(url))
    .replace(/\b(?:authorization|proxy-authorization|cookie|set-cookie|api[-_]?key|[a-z0-9_-]*(?:password|token|secret))\s*[:=]\s*[^\r\n]+/gi, "[credential redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\bsk-[a-zA-Z0-9_-]+/g, "[API key redacted]");
}

export function sourceErrorDiagnostics(error: unknown, depth = 0): Record<string, unknown> {
  if (depth >= 6) return { message: "[cause depth limit]" };
  if (!(error instanceof Error)) {
    return { message: typeof error === "string" ? redactDiagnostic(error) : "Unknown error" };
  }

  const details: Record<string, unknown> = {
    name: redactDiagnostic(error.name),
    message: redactDiagnostic(error.message),
    ...(error instanceof ContentFetchError ? { upstream: error.upstream } : {}),
    stack: error.stack ? redactDiagnostic(error.stack) : undefined
  };
  // Preserve useful network details without serializing arbitrary error/request objects.
  for (const key of ["code", "errno", "syscall", "hostname"] as const) {
    const value = (error as unknown as Record<string, unknown>)[key];
    if (typeof value === "string") details[key] = redactDiagnostic(value);
    if (typeof value === "number") details[key] = value;
  }
  if (error.cause !== undefined) details.cause = sourceErrorDiagnostics(error.cause, depth + 1);
  if (error instanceof AggregateError) {
    details.errors = error.errors.map((item) => sourceErrorDiagnostics(item, depth + 1));
  }
  return details;
}

export class ContentFetchError extends Error {
  readonly upstream: {
    requestedUrl: string;
    finalUrl?: string;
    status?: number;
    statusText?: string;
    contentType?: string | null;
  };

  constructor(url: string, cause: unknown, response?: Response) {
    const reason = response && !response.ok
      ? `The website returned HTTP ${response.status} ${redactDiagnostic(response.statusText)}.`
      : response ? "The website response could not be read." : "The website could not be reached.";
    super(`${reason} Open the article in your browser, then paste its text below to import the books.`, { cause });
    this.name = "ContentFetchError";
    this.upstream = {
      requestedUrl: safeUrl(url),
      ...(response ? {
        finalUrl: safeUrl(response.url || url),
        status: response.status,
        statusText: redactDiagnostic(response.statusText),
        contentType: response.headers.has("content-type")
          ? redactDiagnostic(response.headers.get("content-type")!) : null
      } : {})
    };
  }
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function extractTitle(html: string, fallback: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return decodeHtmlEntities(titleMatch?.[1]?.trim() || fallback);
}

function htmlToText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<img[^>]*>/gi, " ")
      .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6|br)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\n\s*\n+/g, "\n")
      .replace(/[ \t]+/g, " ")
      .trim()
  );
}

export async function fetchReadableContent(url: string) {
  let response: Response | undefined;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": "BookRecommendationsBot/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`Upstream returned HTTP ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const textContent = htmlToText(html);

    return {
      title: extractTitle(html, url),
      textContent
    };
  } catch (cause) {
    throw new ContentFetchError(url, cause, response);
  }
}
