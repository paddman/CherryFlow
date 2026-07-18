import assert from "node:assert/strict";
import test from "node:test";
import { foldEmbedding, localEmbedding, MEMORY_VECTOR_DIMENSIONS } from "./embedding-provider.js";
import { pgVectorLiteral } from "./memory-store.js";

test("local embeddings are deterministic and normalized", () => {
  const first = localEmbedding("CherryFlow remembers PostgreSQL operations");
  const second = localEmbedding("CherryFlow remembers PostgreSQL operations");
  assert.deepEqual(first, second);
  assert.equal(first.length, MEMORY_VECTOR_DIMENSIONS);
  const magnitude = Math.sqrt(first.reduce((sum, value) => sum + value * value, 0));
  assert.ok(Math.abs(magnitude - 1) < 1e-10);
});

test("external vectors are folded into the pgvector index dimensions", () => {
  const folded = foldEmbedding([1, 2, 3, 4, 5], 3);
  assert.equal(folded.length, 3);
  const magnitude = Math.sqrt(folded.reduce((sum, value) => sum + value * value, 0));
  assert.ok(Math.abs(magnitude - 1) < 1e-10);
});

test("pgVectorLiteral rejects invalid dimensions", () => {
  assert.throws(() => pgVectorLiteral([1, 2, 3]), /Expected 384 embedding dimensions/);
  const literal = pgVectorLiteral(Array<number>(MEMORY_VECTOR_DIMENSIONS).fill(0));
  assert.ok(literal.startsWith("["));
  assert.ok(literal.endsWith("]"));
});
