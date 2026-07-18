import { createHash } from "node:crypto";

export const MEMORY_VECTOR_DIMENSIONS = 384;

export interface EmbeddingResult {
  vector: number[];
  provider: "local" | "openai";
  model: string;
}

interface OpenAiEmbeddingResponse {
  data?: Array<{ embedding?: number[] }>;
}

function normalize(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    const fallback = Array<number>(MEMORY_VECTOR_DIMENSIONS).fill(0);
    fallback[0] = 1;
    return fallback;
  }
  return vector.map((value) => value / magnitude);
}

export function foldEmbedding(input: readonly number[], dimensions = MEMORY_VECTOR_DIMENSIONS): number[] {
  if (!Number.isInteger(dimensions) || dimensions < 1) throw new Error("Embedding dimensions must be a positive integer");
  const output = Array<number>(dimensions).fill(0);
  for (let index = 0; index < input.length; index += 1) {
    const value = input[index];
    if (value === undefined || !Number.isFinite(value)) throw new Error("Embedding contains a non-finite value");
    const target = index % dimensions;
    output[target] = (output[target] ?? 0) + value;
  }
  return normalize(output);
}

export function localEmbedding(text: string): number[] {
  const normalizedText = text.normalize("NFKC").toLocaleLowerCase();
  const tokens = normalizedText.match(/[\p{L}\p{N}]+/gu) ?? [];
  const features = tokens.flatMap((token, index) => {
    const next = tokens[index + 1];
    return next ? [token, `${token}:${next}`] : [token];
  });
  const vector = Array<number>(MEMORY_VECTOR_DIMENSIONS).fill(0);

  for (const feature of features) {
    const digest = createHash("sha256").update(feature, "utf8").digest();
    for (let offset = 0; offset < 16; offset += 4) {
      const bucket = digest.readUInt16BE(offset) % MEMORY_VECTOR_DIMENSIONS;
      const sign = (digest[offset + 2] ?? 0) % 2 === 0 ? 1 : -1;
      const weight = 0.5 + (digest[offset + 3] ?? 0) / 255;
      vector[bucket] = (vector[bucket] ?? 0) + sign * weight;
    }
  }

  return normalize(vector);
}

function embeddingProvider(): "local" | "openai" {
  const configured = (process.env.CHERRYFLOW_EMBEDDING_PROVIDER ?? (process.env.EMBEDDING_MODEL ? "openai" : "local"))
    .trim()
    .toLowerCase();
  if (configured !== "local" && configured !== "openai") {
    throw new Error(`Unsupported embedding provider: ${configured}`);
  }
  return configured;
}

async function openAiEmbedding(text: string): Promise<EmbeddingResult> {
  const baseUrl = (process.env.EMBEDDING_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "http://127.0.0.1:8000/v1").replace(/\/$/, "");
  const model = process.env.EMBEDDING_MODEL ?? "qwen3-embedding";
  const apiKey = process.env.EMBEDDING_API_KEY ?? process.env.OPENAI_API_KEY;
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ model, input: text }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1_000);
    throw new Error(`Embedding endpoint failed (${response.status}): ${detail}`);
  }

  const payload = await response.json() as OpenAiEmbeddingResponse;
  const embedding = payload.data?.[0]?.embedding;
  if (!embedding?.length) throw new Error("Embedding endpoint returned no vector");
  return { vector: foldEmbedding(embedding), provider: "openai", model };
}

export async function embedText(text: string): Promise<EmbeddingResult> {
  const content = text.trim();
  if (!content) throw new Error("Text is required for embedding");
  if (embeddingProvider() === "openai") return openAiEmbedding(content);
  return {
    vector: localEmbedding(content),
    provider: "local",
    model: "cherryflow-local-hash-v1",
  };
}
