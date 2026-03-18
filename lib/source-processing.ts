import { z } from "zod";
import { fetchReadableContent } from "@/lib/content-fetch";
import { normalizeObsidianMarkdown } from "@/lib/markdown";
import { getOpenAIClient } from "@/lib/openai";
import type { ExtractedBookCandidate, SourceType } from "@/lib/types";

const extractedBookSchema = z.object({
  title: z.string(),
  author: z.string(),
  confidence: z.number().optional(),
  snippet: z.string().optional(),
  rationale: z.string().optional(),
  sourceSection: z.string().optional(),
  tags: z.array(z.string()).optional()
});

const extractedPayloadSchema = z.object({
  recommender: z.string().optional(),
  sourceSummary: z.string().optional(),
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
            recommender: { type: "string" },
            sourceSummary: { type: "string" },
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
          required: ["books"]
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

  return {
    recommender: parsed.recommender,
    sourceSummary: parsed.sourceSummary,
    books: parsed.books.length > 0 ? parsed.books : fallback,
    modelProvider: "openai",
    modelName: completion.model
  };
}
