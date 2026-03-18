import type { BookRecord, ParsedRecommendationQuery, UserTasteProfile } from "@/lib/types";

export const demoBooks: BookRecord[] = [
  {
    id: "book-1",
    title: "Small Things Like These",
    author: "Claire Keegan",
    canonicalSummary:
      "A quiet, short novel about moral courage, family life, and a small Irish town in the run-up to Christmas.",
    metadata: {
      shortSummary: "Quiet literary fiction with winter atmosphere and emotional depth.",
      readingTraits: {
        genre: ["fiction", "literary fiction"],
        tone: ["quiet", "reflective", "tender"],
        length: "short",
        pace: "moderate"
      }
    },
    tags: ["fiction", "holiday", "short", "literary"]
  },
  {
    id: "book-2",
    title: "The Summer Book",
    author: "Tove Jansson",
    canonicalSummary:
      "A concise and luminous novel about a girl and her grandmother spending time on a remote island.",
    metadata: {
      shortSummary: "Short, warm, contemplative fiction with nature and family themes.",
      readingTraits: {
        genre: ["fiction"],
        tone: ["gentle", "contemplative"],
        length: "short",
        pace: "slow"
      }
    },
    tags: ["fiction", "short", "family", "nature"]
  },
  {
    id: "book-3",
    title: "Piranesi",
    author: "Susanna Clarke",
    canonicalSummary:
      "An imaginative and atmospheric novel about memory, mystery, and a surreal house of endless halls.",
    metadata: {
      shortSummary: "Inventive speculative fiction with mystery and wonder.",
      readingTraits: {
        genre: ["fiction", "speculative fiction"],
        tone: ["dreamlike", "mysterious"],
        length: "medium",
        pace: "moderate"
      }
    },
    tags: ["fiction", "mystery", "speculative"]
  }
];

export const demoTasteProfile: UserTasteProfile = {
  userId: "demo-user",
  likedGenres: ["fiction", "literary fiction"],
  dislikedGenres: [],
  preferredTones: ["reflective", "gentle"],
  preferredLengths: ["short"],
  summary: "Prefers short reflective fiction and elegant prose."
};

export const defaultParsedQuery = (query: string): ParsedRecommendationQuery => ({
  originalQuery: query,
  normalizedQuery: query.toLowerCase().trim(),
  desiredGenres: [],
  desiredTones: [],
  desiredLengths: [],
  themes: [],
  exclusions: [],
  semanticSummary: query.trim()
});
