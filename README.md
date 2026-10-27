# Marginalia

A Next.js MVP for ingesting book recommendations from emails, web links, and markdown/Obsidian files, then serving personalized recommendations from a curated database.

## Stack

- Next.js 16 App Router
- TypeScript
- Prisma + PostgreSQL
- NextAuth
- OpenAI for extraction/enrichment hooks
- Vitest

## Features implemented

- Email/password signup plus Google/NextAuth login scaffolding
- Private-first source ingestion for:
  - pasted email content
  - web links
  - pasted markdown
  - uploaded `.md` files
- Obsidian-aware markdown normalization:
  - frontmatter
  - wiki links
  - headings
  - inline tags
- Extraction pipeline with OpenAI-first and heuristic fallback modes
- Shared catalog, private submissions, admin review endpoints
- Book detail, lists, profile, and recommendation UI
- Natural-language recommendation ranking based on query parsing and taste profile signals

## Run locally

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL`, `NEXTAUTH_SECRET`, and optionally Google/OpenAI credentials.
3. Generate Prisma client:

```bash
npm run prisma:generate
```

4. Run migrations:

```bash
npm run prisma:migrate
```

5. Seed demo data:

```bash
npm run seed
```

6. Start the app:

```bash
npm run dev
```

## Verification

```bash
npm test
npm run lint
npm run build
```

`npm run build` succeeds without a configured database, but Prisma will log that `DATABASE_URL` is missing while static pages fall back to demo content. For real usage, configure Postgres first.
## Debugging web-link imports

`POST /api/sources` logs retrieval failures as `Failed to submit source` with the
original exception, nested cause(s), and upstream HTTP status, status text, final
URL, and content type when a response was received. URL credentials, query strings,
and fragments are stripped from diagnostics; request/response headers and bodies
are never logged. Common credential patterns in error messages are redacted.

To reproduce retrieval using the same fetch helper and sanitized diagnostics:

```bash
node --import tsx --input-type=module <<'JS'
import { fetchReadableContent, sourceErrorDiagnostics } from './lib/content-fetch.ts';
const url = 'https://marginalrevolution.com/marginalrevolution/2026/10/tyler-cowens-strongest-book-recommendations-over-the-years.html';
try {
  const article = await fetchReadableContent(url);
  console.log({ title: article.title, textLength: article.textContent.length });
} catch (error) {
  console.error(JSON.stringify(sourceErrorDiagnostics(error), null, 2));
  process.exitCode = 1;
}
JS
```

Retrieval errors return HTTP 502 with `code: SOURCE_FETCH_FAILED` and
`canPasteText: true`. The form reveals a paste-text fallback. Supplying `rawText`
alongside a `web_link` and its `url` skips retrieval, extracts books from the pasted
article, and retains the URL as attribution. The existing user agent and fetch
behavior are unchanged; no proxy or automatic blocking bypass is attempted.

`tests/source-submission.test.ts` exercises both normal and paste-text submissions
through the route and processing pipeline with mocked authentication and database
boundaries. It does not establish that a production database write succeeded.

Each submission now has a UUID reference shared by the browser and server. Safe
`Source submission` events record stage start/end, elapsed time, selected model
names, extracted book count, and save success. They do not log article text,
titles, user identity, headers, or cookies. If the browser loses the connection,
use its import reference to find whether processing stopped or saved successfully
before retrying. The selected text model is logged with the input event, and the
extraction response's actual model is logged on completion.
