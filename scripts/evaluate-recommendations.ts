import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { listBooksForUser, getTasteProfile } from "@/lib/data";
import { recommendBooks } from "@/lib/recommendations";

// Run the previous checkout in its own process so its tsconfig aliases and
// model settings resolve against that checkout. Both versions see one snapshot.
const baselineProgram = `
  import { readFileSync } from "node:fs";
  import { parseRecommendationQueryWithAI, rankRecommendations } from "./lib/recommendations";
  import { createEmbeddings } from "./lib/openai";
  async function run() {
    const { books, taste, query } = JSON.parse(readFileSync(0, "utf8"));
    const intent = await parseRecommendationQueryWithAI(query);
    const [vector] = await createEmbeddings([intent.semanticSummary || query]);
    const results = rankRecommendations(books, intent, taste, vector);
    process.stdout.write(JSON.stringify(results.slice(0,3).map(({ book, reason }) => ({ title: book.title, author: book.author, reason: reason.summary }))));
  }
  run().catch(() => process.exitCode = 1);
`;

async function main() {
  const [userId, previousCheckout] = process.argv.slice(2);
  if (!userId || !previousCheckout || !process.env.OPENAI_API_KEY) {
    throw new Error("Provide a user ID, previous checkout and OpenAI API key.");
  }
  const [books, taste, history] = await Promise.all([
    listBooksForUser(userId, { requireCatalogue: true }),
    getTasteProfile(userId),
    prisma.recommendationQuery.findMany({
      where: { userId }, orderBy: { createdAt: "desc" }, distinct: ["rawQuery"],
      take: 30, select: { rawQuery: true }
    })
  ]);
  const queries = [...new Set(["I want a short fiction novel that is not about family sagas", ...history.map(row => row.rawQuery)])].slice(0, 30);
  for (const query of queries) {
    const baseline = spawnSync(resolve(previousCheckout, "node_modules/.bin/tsx"), ["-e", baselineProgram], {
      cwd: previousCheckout, input: JSON.stringify({ books, taste, query }), encoding: "utf8"
    });
    if (baseline.status !== 0) throw new Error("The previous recommendation engine failed.");
    const { intent, results } = await recommendBooks(query, books, taste);
    console.log(JSON.stringify({
      query, intent, previous: JSON.parse(baseline.stdout),
      current: results.slice(0,3).map(({ book, reason }) => ({ title: book.title, author: book.author, reason: reason.summary }))
    }));
  }
}
main().catch(() => {
  console.error("Comparison incomplete. Check database, API access, user ID and previous checkout dependencies.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
