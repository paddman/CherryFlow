import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool, PoolClient } from "pg";

const MIGRATION_FILE_PATTERN = /^(\d{4,})_([a-z0-9][a-z0-9_-]*)\.sql$/i;
const UP_MARKER = "-- migrate:up";
const DOWN_MARKER = "-- migrate:down";
const MIGRATION_LOCK_ID = "73436296012026";
const DEFAULT_MIGRATION_DIRECTORY = fileURLToPath(new URL("../../migrations/", import.meta.url));

export interface MigrationFile {
  version: number;
  name: string;
  filename: string;
  checksum: string;
  upSql: string;
  downSql: string;
}

export interface MigrationStatus {
  version: number;
  name: string;
  filename: string;
  state: "applied" | "pending";
  appliedAt?: string;
}

interface AppliedMigration {
  version: number;
  name: string;
  checksum: string;
  appliedAt: string;
}

export interface MigrationRunOptions {
  directory?: string;
  logger?: (message: string) => void;
}

export function migrationChecksum(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function parseMigrationSql(filename: string, content: string): MigrationFile {
  const filenameMatch = MIGRATION_FILE_PATTERN.exec(filename);
  if (!filenameMatch) {
    throw new Error(`Invalid migration filename: ${filename}. Expected NNNN_name.sql.`);
  }

  const upMarkerIndex = content.indexOf(UP_MARKER);
  if (upMarkerIndex < 0) throw new Error(`Migration ${filename} is missing ${UP_MARKER}.`);

  const downMarkerIndex = content.indexOf(DOWN_MARKER, upMarkerIndex + UP_MARKER.length);
  const upStart = upMarkerIndex + UP_MARKER.length;
  const upSql = content.slice(upStart, downMarkerIndex < 0 ? undefined : downMarkerIndex).trim();
  const downSql = downMarkerIndex < 0 ? "" : content.slice(downMarkerIndex + DOWN_MARKER.length).trim();

  if (!upSql) throw new Error(`Migration ${filename} has an empty up section.`);

  return {
    version: Number(filenameMatch[1]),
    name: filenameMatch[2] ?? "migration",
    filename,
    checksum: migrationChecksum(content),
    upSql,
    downSql,
  };
}

export async function loadMigrations(directory = DEFAULT_MIGRATION_DIRECTORY): Promise<MigrationFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const migrations: MigrationFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".sql")) continue;
    const content = await readFile(resolve(directory, entry.name), "utf8");
    migrations.push(parseMigrationSql(entry.name, content));
  }

  migrations.sort((left, right) => left.version - right.version);
  for (let index = 1; index < migrations.length; index += 1) {
    const previous = migrations[index - 1];
    const current = migrations[index];
    if (previous && current && previous.version === current.version) {
      throw new Error(`Duplicate migration version ${current.version}: ${previous.filename} and ${current.filename}.`);
    }
  }

  return migrations;
}

async function ensureMigrationTable(client: PoolClient): Promise<void> {
  await client.query(`
    create table if not exists schema_migrations (
      version bigint primary key,
      name text not null,
      checksum char(64) not null,
      applied_at timestamptz not null default now(),
      execution_ms integer not null
    )
  `);
}

async function readAppliedMigrations(client: PoolClient): Promise<AppliedMigration[]> {
  const result = await client.query(
    "select version, name, checksum, applied_at from schema_migrations order by version",
  );
  return result.rows.map((row) => ({
    version: Number(row.version),
    name: String(row.name),
    checksum: String(row.checksum),
    appliedAt: new Date(String(row.applied_at)).toISOString(),
  }));
}

function validateAppliedMigrations(migrations: MigrationFile[], applied: AppliedMigration[]): void {
  const filesByVersion = new Map(migrations.map((migration) => [migration.version, migration]));

  for (const record of applied) {
    const migration = filesByVersion.get(record.version);
    if (!migration) {
      throw new Error(`Applied migration ${record.version}_${record.name} is missing from the repository.`);
    }
    if (migration.name !== record.name) {
      throw new Error(`Migration ${record.version} was renamed from ${record.name} to ${migration.name}.`);
    }
    if (migration.checksum !== record.checksum) {
      throw new Error(`Migration ${migration.filename} was modified after it was applied.`);
    }
  }
}

export async function getMigrationStatus(
  pool: Pool,
  directory = DEFAULT_MIGRATION_DIRECTORY,
): Promise<MigrationStatus[]> {
  const migrations = await loadMigrations(directory);
  const client = await pool.connect();
  try {
    await ensureMigrationTable(client);
    const applied = await readAppliedMigrations(client);
    validateAppliedMigrations(migrations, applied);
    const appliedByVersion = new Map(applied.map((record) => [record.version, record]));

    return migrations.map((migration) => {
      const record = appliedByVersion.get(migration.version);
      if (!record) {
        return {
          version: migration.version,
          name: migration.name,
          filename: migration.filename,
          state: "pending",
        };
      }
      return {
        version: migration.version,
        name: migration.name,
        filename: migration.filename,
        state: "applied",
        appliedAt: record.appliedAt,
      };
    });
  } finally {
    client.release();
  }
}

export async function runMigrations(pool: Pool, options: MigrationRunOptions = {}): Promise<MigrationStatus[]> {
  const directory = options.directory ?? DEFAULT_MIGRATION_DIRECTORY;
  const logger = options.logger ?? ((message: string) => console.info(message));
  const migrations = await loadMigrations(directory);
  const client = await pool.connect();
  let locked = false;

  try {
    await client.query("select pg_advisory_lock($1::bigint)", [MIGRATION_LOCK_ID]);
    locked = true;
    await ensureMigrationTable(client);

    const applied = await readAppliedMigrations(client);
    validateAppliedMigrations(migrations, applied);
    const appliedVersions = new Set(applied.map((record) => record.version));

    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) continue;

      logger(`[db] applying ${migration.filename}`);
      const startedAt = Date.now();
      await client.query("begin");
      try {
        await client.query(migration.upSql);
        await client.query(
          `insert into schema_migrations (version, name, checksum, execution_ms)
           values ($1, $2, $3, $4)`,
          [migration.version, migration.name, migration.checksum, Date.now() - startedAt],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
      logger(`[db] applied ${migration.filename}`);
    }
  } finally {
    if (locked) await client.query("select pg_advisory_unlock($1::bigint)", [MIGRATION_LOCK_ID]);
    client.release();
  }

  return getMigrationStatus(pool, directory);
}
