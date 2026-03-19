import type { BookRecord, ParsedRecommendationQuery, RecommendationReason, UserTasteProfile } from "@/lib/types";
import { defaultParsedQuery } from "@/lib/demo-data";
import { getOpenAIClient } from "@/lib/openai";

const genreKeywords = ["fiction", "nonfiction", "mystery", "speculative", "literary", "history", "memoir"];
const toneKeywords = ["gentle", "funny", "dark", "reflective", "dreamlike", "fast", "quiet", "tender"];
const lengthKeywords = ["short", "medium", "long"];

export function parseRecommendationQuery(query: string): ParsedRecommendationQuery {
  const normalizedQuery = query.toLowerCase().trim();
  const parsed = defaultParsedQuery(query);

  parsed.desiredGenres = genreKeywords.filter((keyword) => normalizedQuery.includes(keyword));
  parsed.desiredTones = toneKeywords.filter((keyword) => normalizedQuery.includes(keyword));
  parsed.desiredLengths = lengthKeywords.filter((keyword) => normalizedQuery.includes(keyword));
  parsed.themes = ["holiday", "travel", "family", "friendship"].filter((keyword) =>
    normalizedQuery.includes(keyword)
  );
  parsed.exclusions = normalizedQuery.includes("not ")
    ? normalizedQuery
        .split("not ")
        .slice(1)
        .map((part) => part.split(" ")[0])
    : [];
  parsed.semanticSummary = normalizedQuery;

  return parsed;
}

export async function parseRecommendationQueryWithAI(query: string): Promise<ParsedRecommendationQuery> {
  const client = getOpenAIClient();
  const fallback = parseRecommendationQuery(query);

  if (!client) {
    return fallback;
  }

  try {
    const response = await client.responses.create({
      model:
        process.env.OPENAI_RECOMMENDATION_MODEL ??
        process.env.OPENAI_EXTRACTION_MODEL ??
        "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You interpret book recommendation requests into structured retrieval intent. Normalize everything to lowercase. Keep lists concise and only include signals explicitly or strongly implicitly requested."
        },
        {
          role: "user",
          content: query
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "recommendation_query",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              originalQuery: { type: "string" },
              normalizedQuery: { type: "string" },
              desiredGenres: {
                type: "array",
                items: { type: "string" }
              },
              desiredTones: {
                type: "array",
                items: { type: "string" }
              },
              desiredLengths: {
                type: "array",
                items: { type: "string" }
              },
              themes: {
                type: "array",
                items: { type: "string" }
              },
              exclusions: {
                type: "array",
                items: { type: "string" }
              },
              semanticSummary: { type: "string" }
            },
            required: [
              "originalQuery",
              "normalizedQuery",
              "desiredGenres",
              "desiredTones",
              "desiredLengths",
              "themes",
              "exclusions",
              "semanticSummary"
            ]
          }
        }
      }
    });

    const raw = response.output_text;
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as ParsedRecommendationQuery;
    return {
      originalQuery: parsed.originalQuery || query,
      normalizedQuery: parsed.normalizedQuery || query.toLowerCase().trim(),
      desiredGenres: (parsed.desiredGenres || []).map((item) => item.toLowerCase()),
      desiredTones: (parsed.desiredTones || []).map((item) => item.toLowerCase()),
      desiredLengths: (parsed.desiredLengths || []).map((item) => item.toLowerCase()),
      themes: (parsed.themes || []).map((item) => item.toLowerCase()),
      exclusions: (parsed.exclusions || []).map((item) => item.toLowerCase()),
      semanticSummary: parsed.semanticSummary || query
    };
  } catch {
    return fallback;
  }
}

export function buildTasteProfile(userId: string, books: BookRecord[]): UserTasteProfile {
  const genres = new Set<string>();
  const tones = new Set<string>();
  const lengths = new Set<string>();

  for (const book of books) {
    for (const genre of book.metadata?.readingTraits?.genre ?? []) {
      genres.add(genre);
    }

    for (const tone of book.metadata?.readingTraits?.tone ?? []) {
      tones.add(tone);
    }

    const length = book.metadata?.readingTraits?.length;
    if (length) {
      lengths.add(length);
    }
  }

  return {
    userId,
    likedGenres: [...genres],
    dislikedGenres: [],
    preferredTones: [...tones],
    preferredLengths: [...lengths],
    summary: `Prefers ${[...lengths].join(", ") || "varied"} reads with ${[...tones].join(", ") || "mixed"} tone.`
  };
}

export function scoreBookForQuery(
  book: BookRecord,
  query: ParsedRecommendationQuery,
  tasteProfile?: UserTasteProfile
) {
  let score = 0;
  const signals: string[] = [];

  for (const genre of query.desiredGenres) {
    if (book.tags?.includes(genre) || book.metadata?.readingTraits?.genre?.includes(genre)) {
      score += 3;
      signals.push(`Matches requested genre: ${genre}`);
    }
  }

  for (const theme of query.themes) {
    if (
      book.tags?.includes(theme) ||
      book.metadata?.readingTraits?.themes?.includes(theme) ||
      book.metadata?.summary?.toLowerCase().includes(theme) ||
      book.canonicalSummary?.toLowerCase().includes(theme)
    ) {
      score += 2;
      signals.push(`Touches requested theme: ${theme}`);
    }
  }

  for (const exclusion of query.exclusions) {
    if (
      book.tags?.includes(exclusion) ||
      book.metadata?.readingTraits?.genre?.includes(exclusion) ||
      book.metadata?.readingTraits?.tone?.includes(exclusion) ||
      book.metadata?.summary?.toLowerCase().includes(exclusion) ||
      book.canonicalSummary?.toLowerCase().includes(exclusion)
    ) {
      score -= 4;
      signals.push(`Penalized for excluded element: ${exclusion}`);
    }
  }

  for (const tone of query.desiredTones) {
    if (book.metadata?.readingTraits?.tone?.includes(tone)) {
      score += 2;
      signals.push(`Fits requested tone: ${tone}`);
    }
  }

  for (const length of query.desiredLengths) {
    if (book.metadata?.readingTraits?.length === length) {
      score += 3;
      signals.push(`Fits requested length: ${length}`);
    }
  }

  if (tasteProfile) {
    for (const genre of tasteProfile.likedGenres) {
      if (book.metadata?.readingTraits?.genre?.includes(genre)) {
        score += 1.5;
      }
    }

    for (const tone of tasteProfile.preferredTones) {
      if (book.metadata?.readingTraits?.tone?.includes(tone)) {
        score += 1;
      }
    }
  }

  if (!signals.length) {
    signals.push("Relevant by overall thematic similarity.");
  }

  return {
    score,
    reason: {
      summary: signals.slice(0, 2).join(". "),
      signals
    } satisfies RecommendationReason
  };
}

export function rankRecommendations(
  books: BookRecord[],
  parsedQuery: ParsedRecommendationQuery,
  tasteProfile?: UserTasteProfile
) {
  return books
    .map((book) => {
      const { score, reason } = scoreBookForQuery(book, parsedQuery, tasteProfile);

      return { book, score, reason, parsedQuery };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);
}
