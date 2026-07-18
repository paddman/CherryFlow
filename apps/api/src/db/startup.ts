import { Pool } from "pg";
import { getMigrationStatus, runMigrations } from "./migrations.js";

const DEFAULT_DATABASE_URL = "postgres://cherryflow:cherryflow@127.0.0.1:5432/cherryflow";

export function postgresConfigured(): boolean {
  return (process.env.CHERRYFLOW_STORE ?? "").toLowerCase() === "postgres" || Boolean(process.env.DATABASE_URL);
}

function autoMigrateEnabled(): boolean {
  const value = (process.env.CHERRYFLOW_AUTO_MIGRATE ?? "true").trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(value);
}

export async function prepareDatabase(): Promise<void> {
  if (!postgresConfigured()) return;

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  });

  try {
    if (autoMigrateEnabled()) {
      await runMigrations(pool);
      return;
    }

    const status = await getMigrationStatus(pool);
    const pending = status.filter((migration) => migration.state === "pending");
    if (pending.length > 0) {
      throw new Error(
        `Database has ${pending.length} pending migration(s). Run pnpm db:migrate before starting CherryFlow.`,
      );
    }
  } finally {
    await pool.end();
  }
}
