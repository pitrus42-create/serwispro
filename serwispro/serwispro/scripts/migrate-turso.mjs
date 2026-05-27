// Applies all Prisma migrations to Turso via libsql client
import { createClient } from "@libsql/client";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  process.exit(1);
}

const client = createClient({ url, authToken });

// Create migrations tracking table if not exists
await client.execute(`
  CREATE TABLE IF NOT EXISTS _prisma_migrations (
    id TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    finished_at DATETIME,
    migration_name TEXT NOT NULL,
    logs TEXT,
    rolled_back_at DATETIME,
    started_at DATETIME NOT NULL DEFAULT current_timestamp,
    applied_steps_count INTEGER NOT NULL DEFAULT 0
  )
`);

const migrationsDir = join(projectRoot, "prisma", "migrations");
const migrationFolders = readdirSync(migrationsDir)
  .filter((f) => f !== "migration_lock.toml")
  .sort();

for (const folder of migrationFolders) {
  const sqlPath = join(migrationsDir, folder, "migration.sql");

  // Check if already applied
  const existing = await client.execute({
    sql: "SELECT id FROM _prisma_migrations WHERE migration_name = ?",
    args: [folder],
  });

  if (existing.rows.length > 0) {
    console.log(`⏭  Already applied: ${folder}`);
    continue;
  }

  console.log(`⏳ Applying: ${folder}`);
  const sql = readFileSync(sqlPath, "utf-8");

  // Split on semicolons and execute each statement
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  try {
    for (const statement of statements) {
      await client.execute(statement);
    }

    await client.execute({
      sql: `INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count)
            VALUES (?, ?, ?, datetime('now'), 1)`,
      args: [crypto.randomUUID(), "manual", folder],
    });

    console.log(`✅ Applied: ${folder}`);
  } catch (err) {
    console.error(`❌ Failed: ${folder}`, err.message);
    process.exit(1);
  }
}

console.log("\n✅ All migrations applied to Turso!");
client.close();
