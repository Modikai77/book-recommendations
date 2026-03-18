import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export async function fetchReadableContent(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "BookRecommendationsBot/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch content from ${url}`);
  }

  const html = await response.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  return {
    title: article?.title ?? url,
    textContent: article?.textContent?.trim() ?? ""
  };
}
