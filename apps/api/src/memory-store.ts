import { Pool } from "pg";
import { postgresConfigured } from "./db/startup.js";
import { embedText, MEMORY_VECTOR_DIMENSIONS } from "./embedding-provider.js";

const DEFAULT_DATABASE_URL = "postgres://cherryflow:cherryflow@127.0.0.1:5432/cherryflow";
const MAX_CONTENT_LENGTH = 1_000_000;

export interface MemoryRecord {
  id: string;
  namespace: string;
  sourceId?: string;
  content: string;
  metadata: Record<string, unknown>;
  embeddingProvider: string;
  embeddingModel: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemorySearchResult extends MemoryRecord {
  score: number;
}

export interface UpsertMemoryInput {
  namespace?: string;
  sourceId?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SearchMemoryInput {
  namespace?: string;
  query: string;
  limit?: number;
  minScore?: number;
}

let pool: Pool | undefined;

export function memoryEnabled(): boolean {
  return postgresConfigured();
}

function database(): Pool {
  if (!memoryEnabled()) throw new Error("AI memory requires CHERRYFLOW_STORE=postgres or DATABASE_URL");
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL });
  return pool;
}

function cleanNamespace(value: string | undefined): string {
  const namespace = value?.trim() || "default";
  if (namespace.length > 128) throw new Error("Memory namespace must be 128 characters or fewer");
  return namespace;
}

function cleanSourceId(value: string | undefined): string | undefined {
  const sourceId = value?.trim();
  if (!sourceId) return undefined;
  if (sourceId.length > 512) throw new Error("Memory sourceId must be 512 characters or fewer");
  return sourceId;
}

export function pgVectorLiteral(vector: readonly number[]): string {
  if (vector.length !== MEMORY_VECTOR_DIMENSIONS) {
    throw new Error(`Expected ${MEMORY_VECTOR_DIMENSIONS} embedding dimensions, received ${vector.length}`);
  }
  if (vector.some((value) => !Number.isFinite(value))) throw new Error("Embedding contains a non-finite value");
  return `[${vector.join(",")}]`;
}

function mapMemory(row: Record<string, unknown>): MemoryRecord {
  const result: MemoryRecord = {
    id: String(row.id),
    namespace: String(row.namespace),
    content: String(row.content),
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    embeddingProvider: String(row.embedding_provider),
    embeddingModel: String(row.embedding_model),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
  if (row.source_id) result.sourceId = String(row.source_id);
  return result;
}

export async function upsertMemory(input: UpsertMemoryInput): Promise<MemoryRecord> {
  const namespace = cleanNamespace(input.namespace);
  const sourceId = cleanSourceId(input.sourceId);
  const content = input.content?.trim();
  if (!content) throw new Error("Memory content is required");
  if (content.length > MAX_CONTENT_LENGTH) throw new Error(`Memory content exceeds ${MAX_CONTENT_LENGTH} characters`);
  const metadata = input.metadata ?? {};
  const embedding = await embedText(content);
  const values = [
    crypto.randomUUID(),
    namespace,
    sourceId ?? null,
    content,
    metadata,
    pgVectorLiteral(embedding.vector),
    embedding.provider,
    embedding.model,
  ];

  const statement = sourceId
    ? `insert into ai_memories (id, namespace, source_id, content, metadata, embedding, embedding_provider, embedding_model)
       values ($1, $2, $3, $4, $5, $6::vector, $7, $8)
       on conflict (namespace, source_id) where source_id is not null
       do update set content = excluded.content, metadata = excluded.metadata, embedding = excluded.embedding,
         embedding_provider = excluded.embedding_provider, embedding_model = excluded.embedding_model, updated_at = now()
       returning *`
    : `insert into ai_memories (id, namespace, source_id, content, metadata, embedding, embedding_provider, embedding_model)
       values ($1, $2, $3, $4, $5, $6::vector, $7, $8)
       returning *`;

  const result = await database().query(statement, values);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error("AI memory insert returned no record");
  return mapMemory(row);
}

export async function searchMemory(input: SearchMemoryInput): Promise<MemorySearchResult[]> {
  const query = input.query?.trim();
  if (!query) throw new Error("Memory search query is required");
  const namespace = input.namespace?.trim() ? cleanNamespace(input.namespace) : null;
  const limit = Math.max(1, Math.min(50, Math.floor(input.limit ?? 8)));
  const minScore = Math.max(-1, Math.min(1, input.minScore ?? 0));
  const embedding = await embedText(query);
  const vector = pgVectorLiteral(embedding.vector);
  const result = await database().query(
    `select id, namespace, source_id, content, metadata, embedding_provider, embedding_model, created_at, updated_at,
       (1 - (embedding <=> $1::vector))::float8 as score
     from ai_memories
     where embedding_model = $2
       and ($3::text is null or namespace = $3)
       and (1 - (embedding <=> $1::vector)) >= $4
     order by embedding <=> $1::vector
     limit $5`,
    [vector, embedding.model, namespace, minScore, limit],
  );

  return result.rows.map((rawRow) => {
    const row = rawRow as Record<string, unknown>;
    return { ...mapMemory(row), score: Number(row.score) };
  });
}

export async function memoryStats(): Promise<{ total: number; groups: Array<{ namespace: string; model: string; count: number }> }> {
  const result = await database().query(
    `select namespace, embedding_model, count(*)::int as count
     from ai_memories
     group by namespace, embedding_model
     order by namespace, embedding_model`,
  );
  const groups = result.rows.map((rawRow) => {
    const row = rawRow as Record<string, unknown>;
    return { namespace: String(row.namespace), model: String(row.embedding_model), count: Number(row.count) };
  });
  return { total: groups.reduce((sum, group) => sum + group.count, 0), groups };
}

export async function deleteMemory(id: string): Promise<boolean> {
  const memoryId = id.trim();
  if (!memoryId) throw new Error("Memory id is required");
  const result = await database().query("delete from ai_memories where id = $1", [memoryId]);
  return (result.rowCount ?? 0) > 0;
}
