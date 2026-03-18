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
# book-recommendations
