import { z } from "zod";
import { fetchReadableContent } from "@/lib/content-fetch";
import { normalizeObsidianMarkdown } from "@/lib/markdown";
import { createEmbeddings, getOpenAIClient } from "@/lib/openai";
import type { ExtractedBookCandidate, SourceType } from "@/lib/types";

const extractedBookSchema = z.object({
  title: z.string(),
  author: z.string(),
  bookSummary: z.string().nullable().optional(),
  confidence: z.number().nullable().optional(),
  snippet: z.string().nullable().optional(),
  rationale: z.string().nullable().optional(),
  sourceSection: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional()
});

const extractedPayloadSchema = z.object({
  recommender: z.string().nullable().optional(),
  sourceSummary: z.string().nullable().optional(),
  books: z.array(extractedBookSchema)
});

export async function normalizeSourceInput(input: {
  type: SourceType;
  rawText?: string;
  url?: string;
}) {
  if (input.type === "web_link") {
    if (!input.url) {
      throw new Error("URL is required for web link sources.");
    }

    const article = await fetchReadableContent(input.url);

    return {
      title: article.title,
      rawText: input.url,
      parsedText: article.textContent,
      metadata: { fetchedFrom: input.url }
    };
  }

  if (!input.rawText) {
    throw new Error("Source text is required.");
  }

  if (input.type === "markdown") {
    const parsed = normalizeObsidianMarkdown(input.rawText);

    return {
      title: parsed.title,
      rawText: input.rawText,
      parsedText: parsed.plainText,
      metadata: {
        frontmatter: parsed.frontmatter,
        headings: parsed.headings,
        inlineTags: parsed.inlineTags,
        wikiLinks: parsed.wikiLinks
      }
    };
  }

  return {
    title: undefined,
    rawText: input.rawText,
    parsedText: input.rawText,
    metadata: {}
  };
}

function heuristicExtraction(parsedText: string): ExtractedBookCandidate[] {
  const lines = parsedText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates: Array<ExtractedBookCandidate | null> = lines.map((line) => {
      const byMatch = line.match(/^(?:[-*]\s*)?(.+?)\s+(?:by|—|-)\s+(.+)$/i);

      if (!byMatch) {
        return null;
      }

      return {
        title: byMatch[1].trim().replace(/^["']|["']$/g, ""),
        author: byMatch[2].trim().replace(/[.)]+$/, ""),
        confidence: 0.45,
        snippet: line
      };
    });

  return candidates.filter((candidate): candidate is ExtractedBookCandidate => candidate !== null);
}

export async function extractBooksFromSource(input: {
  type: SourceType;
  parsedText: string;
  metadata?: Record<string, unknown>;
}): Promise<{
  recommender?: string;
  sourceSummary?: string;
  books: ExtractedBookCandidate[];
  modelProvider: string;
  modelName: string;
}> {
  const client = getOpenAIClient();
  const fallback = heuristicExtraction(input.parsedText);

  if (!client) {
    return {
      books: fallback,
      modelProvider: "heuristic",
      modelName: "line-parser"
    };
  }

  const completion = await client.responses.create({
    model: process.env.OPENAI_EXTRACTION_MODEL ?? "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "Extract recommended books from the source. Return JSON with recommender, sourceSummary, and books. Include only books explicitly recommended or clearly discussed as recommendations."
      },
      {
        role: "user",
        content: JSON.stringify({
          sourceType: input.type,
          metadata: input.metadata ?? {},
          parsedText: input.parsedText
        })
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "book_extraction",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            recommender: { type: ["string", "null"] },
            sourceSummary: { type: ["string", "null"] },
            books: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: "string" },
                  author: { type: "string" },
                  confidence: { type: ["number", "null"] },
                  snippet: { type: ["string", "null"] },
                  rationale: { type: ["string", "null"] },
                  sourceSection: { type: ["string", "null"] },
                  tags: {
                    anyOf: [
                      {
                        type: "array",
                        items: { type: "string" }
                      },
                      { type: "null" }
                    ]
                  }
                },
                required: ["title", "author", "confidence", "snippet", "rationale", "sourceSection", "tags"]
              }
            }
          },
          required: ["recommender", "sourceSummary", "books"]
        }
      }
    }
  });

  const rawOutput = completion.output_text;

  if (!rawOutput) {
    return {
      books: fallback,
      modelProvider: "openai",
      modelName: completion.model
    };
  }

  const parsed = extractedPayloadSchema.parse(JSON.parse(rawOutput));
  const normalizedBooks: ExtractedBookCandidate[] = parsed.books.map((book) => ({
    title: book.title,
    author: book.author,
    bookSummary: book.bookSummary ?? undefined,
    confidence: book.confidence ?? undefined,
    snippet: book.snippet ?? undefined,
    rationale: book.rationale ?? undefined,
    sourceSection: book.sourceSection ?? undefined,
    tags: book.tags ?? undefined
  }));

  return {
    recommender: parsed.recommender ?? undefined,
    sourceSummary: parsed.sourceSummary ?? undefined,
    books: normalizedBooks.length > 0 ? normalizedBooks : fallback,
    modelProvider: "openai",
    modelName: completion.model
  };
}

const summaryItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  summary: z.string()
});

const summaryPayloadSchema = z.object({
  books: z.array(summaryItemSchema)
});

function fallbackBookSummary(candidate: ExtractedBookCandidate) {
  return (
    candidate.bookSummary ||
    candidate.rationale ||
    candidate.snippet ||
    `${candidate.title} by ${candidate.author}.`
  );
}

export async function enrichBookSummaries(input: {
  parsedText: string;
  sourceTitle?: string;
  recommender?: string;
  books: ExtractedBookCandidate[];
}) {
  if (!input.books.length) {
    return input.books;
  }

  const client = getOpenAIClient();
  if (!client) {
    return input.books.map((book) => ({
      ...book,
      bookSummary: fallbackBookSummary(book)
    }));
  }

  try {
    const response = await client.responses.create({
      model:
        process.env.OPENAI_SUMMARY_MODEL ??
        process.env.OPENAI_EXTRACTION_MODEL ??
        "gpt-4.1-mini",
      tools: [{ type: "web_search" }],
      tool_choice: "auto",
      input: [
        {
          role: "system",
          content:
            "Write a concise 1-2 sentence summary for each listed book. Use the source text when sufficient. If the source text does not explain the book, use web search to verify and fill the gap. Do not invent details."
        },
        {
          role: "user",
          content: JSON.stringify({
            sourceTitle: input.sourceTitle,
            recommender: input.recommender,
            parsedText: input.parsedText,
            books: input.books.map((book, index) => ({
              id: String(index),
              title: book.title,
              author: book.author,
              snippet: book.snippet,
              rationale: book.rationale
            }))
          })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "book_summaries",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              books: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    author: { type: "string" },
                    summary: { type: "string" }
                  },
                  required: ["id", "title", "author", "summary"]
                }
              }
            },
            required: ["books"]
          }
        }
      }
    });

    const rawOutput = response.output_text;
    if (!rawOutput) {
      return input.books.map((book) => ({
        ...book,
        bookSummary: fallbackBookSummary(book)
      }));
    }

    const parsed = summaryPayloadSchema.parse(JSON.parse(rawOutput));
    const summaryById = new Map(parsed.books.map((book) => [book.id, book.summary]));

    return input.books.map((book, index) => ({
      ...book,
      bookSummary: summaryById.get(String(index)) || fallbackBookSummary(book)
    }));
  } catch {
    return input.books.map((book) => ({
      ...book,
      bookSummary: fallbackBookSummary(book)
    }));
  }
}

export async function enrichBookEmbeddings(books: ExtractedBookCandidate[]) {
  if (!books.length) {
    return books;
  }

  try {
    const embeddings = await createEmbeddings(
      books.map((book) =>
        [book.title, book.author, book.bookSummary || book.rationale || book.snippet]
          .filter(Boolean)
          .join(". ")
      )
    );

    return books.map((book, index) => ({
      ...book,
      embedding: embeddings[index] ?? undefined
    }));
  } catch {
    return books;
  }
}

export async function regenerateSingleBookSummary(input: {
  title: string;
  author: string;
  parsedText: string;
  sourceTitle?: string;
  recommender?: string;
  snippet?: string;
  rationale?: string;
}) {
  const [enriched] = await enrichBookSummaries({
    parsedText: input.parsedText,
    sourceTitle: input.sourceTitle,
    recommender: input.recommender,
    books: [
      {
        title: input.title,
        author: input.author,
        snippet: input.snippet,
        rationale: input.rationale
      }
    ]
  });

  const [embedded] = await enrichBookEmbeddings([
    {
      title: input.title,
      author: input.author,
      bookSummary: enriched?.bookSummary,
      snippet: input.snippet,
      rationale: input.rationale
    }
  ]);

  return {
    summary:
      enriched?.bookSummary ||
      input.rationale ||
      input.snippet ||
      `${input.title} by ${input.author}.`,
    embedding: embedded?.embedding
  };
}
