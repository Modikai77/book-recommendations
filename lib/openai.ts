import OpenAI from "openai";

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new OpenAI({ apiKey });
}

export async function createEmbeddings(inputs: string[]) {
  const client = getOpenAIClient();

  if (!client || !inputs.length) {
    return [];
  }

  const response = await client.embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    input: inputs
  });

  return response.data.map((item) => item.embedding);
}
