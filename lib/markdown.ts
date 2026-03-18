import matter from "gray-matter";
import { marked } from "marked";
import type { ParsedMarkdownSource } from "@/lib/types";

const WIKI_LINK_REGEX = /\[\[([^[\]]+)\]\]/g;
const INLINE_TAG_REGEX = /(^|\s)#([a-zA-Z0-9/_-]+)/g;
const HEADING_REGEX = /^#{1,6}\s+(.+)$/gm;
const CALLOUT_REGEX = /^\s*>\s*\[[^\]]+\]\s*/gm;

export function normalizeObsidianMarkdown(rawMarkdown: string): ParsedMarkdownSource {
  const parsed = matter(rawMarkdown);
  const content = parsed.content;
  const wikiLinks = Array.from(content.matchAll(WIKI_LINK_REGEX)).map((match) => match[1].trim());
  const inlineTags = Array.from(content.matchAll(INLINE_TAG_REGEX)).map((match) => match[2].trim());
  const headings = Array.from(content.matchAll(HEADING_REGEX)).map((match) => match[1].trim());

  const normalizedMarkdown = content
    .replace(WIKI_LINK_REGEX, (_, label: string) => label.split("|").pop()?.trim() ?? label)
    .replace(CALLOUT_REGEX, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();

  const plainText = marked
    .parse(normalizedMarkdown, { async: false })
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    title:
      typeof parsed.data.title === "string"
        ? parsed.data.title
        : headings[0],
    frontmatter: parsed.data,
    normalizedMarkdown,
    plainText,
    wikiLinks,
    inlineTags,
    headings
  };
}
