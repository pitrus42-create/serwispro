import { createClient, type Client } from "@libsql/client";
import path from "path";

const globalForDb = globalThis as unknown as { db: Client | undefined };

function createDbClient(): Client {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    return createClient({ url: tursoUrl, authToken: tursoToken });
  }

  const dbPath = path.join(process.cwd(), "prisma", "dev.db");
  return createClient({ url: `file:${dbPath}` });
}

export const db = globalForDb.db ?? createDbClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
