import type { BookRecord, ParsedRecommendationQuery, RecommendationReason, UserTasteProfile } from "@/lib/types";
import { defaultParsedQuery } from "@/lib/demo-data";
import { getOpenAIClient } from "@/lib/openai";

const genreKeywords = ["fiction", "nonfiction", "mystery", "speculative", "literary", "history", "memoir"];
const toneKeywords = ["gentle", "funny", "dark", "reflective", "dreamlike", "fast", "quiet", "tender"];
const lengthKeywords = ["short", "medium", "long"];
const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "books",
  "for",
  "from",
  "in",
  "impact",
  "it",
  "kind",
  "of",
  "on",
  "or",
  "right",
  "the",
  "to",
  "want",
  "with"
]);

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
  const vectors = books.map((book) => book.embedding).filter((vector): vector is number[] => Boolean(vector?.length));

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
    summary: `Prefers ${[...lengths].join(", ") || "varied"} reads with ${[...tones].join(", ") || "mixed"} tone.`,
    preferenceVector: averageVectors(vectors)
  };
}

function cosineSimilarity(left?: number[], right?: number[]) {
  if (!left?.length || !right?.length || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let i = 0; i < left.length; i += 1) {
    dot += left[i] * right[i];
    leftNorm += left[i] * left[i];
    rightNorm += right[i] * right[i];
  }

  if (!leftNorm || !rightNorm) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function averageVectors(vectors: number[][]) {
  if (!vectors.length) {
    return undefined;
  }

  const length = vectors[0].length;
  const total = new Array<number>(length).fill(0);

  for (const vector of vectors) {
    if (vector.length !== length) {
      continue;
    }

    for (let i = 0; i < length; i += 1) {
      total[i] += vector[i];
    }
  }

  return total.map((value) => value / vectors.length);
}

function tokenize(value: string | undefined | null) {
  if (!value) {
    return [];
  }

  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

export function scoreBookForQuery(
  book: BookRecord,
  query: ParsedRecommendationQuery,
  tasteProfile?: UserTasteProfile,
  queryVector?: number[]
) {
  let score = 0;
  const signals: string[] = [];
  const queryTokens = tokenize(query.semanticSummary);
  const titleTokens = new Set(tokenize(book.title));
  const tagTokens = new Set((book.tags || []).flatMap((tag) => tokenize(tag)));
  const summaryTokens = new Set(tokenize(book.metadata?.summary || book.metadata?.shortSummary || book.canonicalSummary));
  const overlappingTitleTokens = queryTokens.filter((token) => titleTokens.has(token));
  const overlappingTagTokens = queryTokens.filter((token) => tagTokens.has(token));
  const overlappingSummaryTokens = queryTokens.filter((token) => summaryTokens.has(token));

  const semanticSimilarity = cosineSimilarity(queryVector, book.embedding);
  if (semanticSimilarity > 0) {
    score += semanticSimilarity * 6;
    if (semanticSimilarity > 0.2) {
      signals.push("Strong semantic match to your request.");
    }
  }

  for (const genre of query.desiredGenres) {
    if (book.tags?.includes(genre) || book.metadata?.readingTraits?.genre?.includes(genre)) {
      score += 2;
      signals.push(`Matches requested genre: ${genre}`);
    }
  }

  if (overlappingTagTokens.length) {
    score += overlappingTagTokens.length * 5;
    signals.push(`Direct topical tag match: ${overlappingTagTokens.join(", ")}`);
  }

  if (overlappingTitleTokens.length) {
    score += overlappingTitleTokens.length * 4;
    signals.push(`Title matches query terms: ${overlappingTitleTokens.join(", ")}`);
  }

  if (overlappingSummaryTokens.length) {
    score += Math.min(overlappingSummaryTokens.length, 3) * 2;
    signals.push(`Summary overlaps with query terms: ${overlappingSummaryTokens.join(", ")}`);
  }

  let matchedTheme = false;
  for (const theme of query.themes) {
    if (
      book.tags?.includes(theme) ||
      book.metadata?.readingTraits?.themes?.includes(theme) ||
      book.metadata?.summary?.toLowerCase().includes(theme) ||
      book.canonicalSummary?.toLowerCase().includes(theme)
    ) {
      score += 4;
      matchedTheme = true;
      signals.push(`Touches requested theme: ${theme}`);
    }
  }

  if (query.themes.length > 0 && !matchedTheme && !overlappingTagTokens.length && !overlappingTitleTokens.length) {
    score -= 3;
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
    const tasteSimilarity = cosineSimilarity(tasteProfile.preferenceVector, book.embedding);
    if (tasteSimilarity > 0) {
      score += tasteSimilarity * 3;
    }

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
  tasteProfile?: UserTasteProfile,
  queryVector?: number[]
) {
  return books
    .map((book) => {
      const { score, reason } = scoreBookForQuery(book, parsedQuery, tasteProfile, queryVector);

      return { book, score, reason, parsedQuery };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);
}
