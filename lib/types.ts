export type SourceType = "email" | "web_link" | "markdown";

export type ExtractedBookCandidate = {
  title: string;
  author: string;
  bookSummary?: string;
  embedding?: number[];
  confidence?: number;
  snippet?: string;
  rationale?: string;
  sourceSection?: string;
  tags?: string[];
};

export type BookReadingTraits = {
  genre?: string[];
  tone?: string[];
  themes?: string[];
  length?: "short" | "medium" | "long";
  pace?: "slow" | "moderate" | "fast";
  difficulty?: "easy" | "moderate" | "challenging";
};

export type BookTagAssignment = {
  tag: string;
  score: number;
  source: "llm" | "admin" | "user";
};

export type ParsedRecommendationQuery = {
  originalQuery: string;
  normalizedQuery: string;
  desiredGenres: string[];
  desiredTones: string[];
  desiredLengths: string[];
  themes: string[];
  exclusions: string[];
  semanticSummary: string;
};

export type RecommendationReason = {
  summary: string;
  signals: string[];
};

export type UserTasteProfile = {
  userId: string;
  likedGenres: string[];
  dislikedGenres: string[];
  preferredTones: string[];
  preferredLengths: string[];
  summary: string;
  preferenceVector?: number[];
};

export type ParsedMarkdownSource = {
  title?: string;
  frontmatter: Record<string, unknown>;
  normalizedMarkdown: string;
  plainText: string;
  wikiLinks: string[];
  inlineTags: string[];
  headings: string[];
};

export type BookRecord = {
  id: string;
  title: string;
  author: string;
  canonicalSummary?: string | null;
  sourceTitle?: string | null;
  sourceType?: string | null;
  submittedAt?: string | null;
  embedding?: number[];
  metadata?: {
    summary?: string | null;
    shortSummary?: string | null;
    readingTraits?: BookReadingTraits | null;
    tags?: string[];
  };
  tags?: string[];
  catalogStatus?: "PRIVATE_ONLY" | "SHARED";
};

export type DashboardSourceItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  submittedAt: string;
  extractedBookCount: number;
};

export type DashboardPromptSuggestion = {
  label: string;
  prompt: string;
};

export type DashboardAttentionItem = {
  id: string;
  kind: "missing_summary" | "empty_source" | "generic_summary";
  title: string;
  detail: string;
  href: "/lists" | "/submit-source";
};

export type DashboardData = {
  userName?: string | null;
  privateBookCount: number;
  sourceCount: number;
  latestSourceDate?: string | null;
  recentSources: DashboardSourceItem[];
  recentBooks: BookRecord[];
  topTags: Array<{ tag: string; count: number }>;
  sourceBreakdown: Array<{ type: string; count: number }>;
  booksAddedLast7Days: number;
  suggestedPrompts: DashboardPromptSuggestion[];
  attentionItems: DashboardAttentionItem[];
  guidance: string;
};
