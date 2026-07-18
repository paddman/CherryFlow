import { Pool } from "pg";
import { getMigrationStatus, runMigrations } from "./migrations.js";

const DEFAULT_DATABASE_URL = "postgres://cherryflow:cherryflow@127.0.0.1:5432/cherryflow";

function printStatus(status: Awaited<ReturnType<typeof getMigrationStatus>>): void {
  if (status.length === 0) {
    console.info("No migration files found.");
    return;
  }

  for (const migration of status) {
    const suffix = migration.appliedAt ? ` (${migration.appliedAt})` : "";
    console.info(`${migration.state.padEnd(7)} ${migration.filename}${suffix}`);
  }
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "up";
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  });

  try {
    if (command === "up" || command === "migrate") {
      const status = await runMigrations(pool);
      printStatus(status);
      return;
    }

    if (command === "status") {
      printStatus(await getMigrationStatus(pool));
      return;
    }

    if (command === "check") {
      const status = await getMigrationStatus(pool);
      const pending = status.filter((migration) => migration.state === "pending");
      printStatus(status);
      if (pending.length > 0) {
        throw new Error(`Database has ${pending.length} pending migration(s).`);
      }
      return;
    }

    throw new Error(`Unknown migration command: ${command}. Use up, status, or check.`);
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
