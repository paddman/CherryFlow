import { fileStorageEnabled } from "./file-storage.js";
import { memoryEnabled } from "./memory-store.js";
import { redisQueueEnabled } from "./redis-queue.js";

export interface RuntimeStatus {
  aiProvider: string;
  embeddingProvider: string;
  store: "json" | "postgres";
  runner: "in_process" | "redis";
  fileStorage: "inline" | "s3";
  memory: "disabled" | "pgvector";
}

export function getRuntimeStatus(): RuntimeStatus {
  const store = (process.env.CHERRYFLOW_STORE ?? (process.env.DATABASE_URL ? "postgres" : "json")).toLowerCase();
  return {
    aiProvider: process.env.CHERRYFLOW_AI_PROVIDER ?? "local",
    embeddingProvider: process.env.CHERRYFLOW_EMBEDDING_PROVIDER ?? (process.env.EMBEDDING_MODEL ? "openai" : "local"),
    store: store === "postgres" ? "postgres" : "json",
    runner: redisQueueEnabled() ? "redis" : "in_process",
    fileStorage: fileStorageEnabled() ? "s3" : "inline",
    memory: memoryEnabled() ? "pgvector" : "disabled",
  };
}
