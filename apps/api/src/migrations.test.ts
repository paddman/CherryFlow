import assert from "node:assert/strict";
import test from "node:test";
import { migrationChecksum, parseMigrationSql } from "./db/migrations.js";

test("parseMigrationSql reads versioned up and down sections", () => {
  const content = `-- migrate:up
create table example (id text primary key);
-- migrate:down
drop table example;
`;
  const migration = parseMigrationSql("0007_add_example.sql", content);

  assert.equal(migration.version, 7);
  assert.equal(migration.name, "add_example");
  assert.equal(migration.upSql, "create table example (id text primary key);");
  assert.equal(migration.downSql, "drop table example;");
  assert.equal(migration.checksum, migrationChecksum(content));
});

test("parseMigrationSql rejects invalid files", () => {
  assert.throws(
    () => parseMigrationSql("add_example.sql", "-- migrate:up\nselect 1;"),
    /Invalid migration filename/,
  );
  assert.throws(
    () => parseMigrationSql("0002_add_example.sql", "select 1;"),
    /missing -- migrate:up/,
  );
  assert.throws(
    () => parseMigrationSql("0002_add_example.sql", "-- migrate:up\n\n-- migrate:down"),
    /empty up section/,
  );
});

test("migrationChecksum detects migration edits", () => {
  assert.notEqual(migrationChecksum("select 1;"), migrationChecksum("select 2;"));
  assert.equal(migrationChecksum("select 1;"), migrationChecksum("select 1;"));
});
