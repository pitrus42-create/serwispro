import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    // Create libsql client explicitly — the adapter's internal client creation
    // has an encoding bug that corrupts multi-byte UTF-8 chars (Polish diacritics)
    const libsql = createClient({ url: tursoUrl, authToken: tursoToken });
    const adapter = new PrismaLibSql(libsql);
    return new PrismaClient({ adapter } as never);
  }

  if (process.env.NODE_ENV === "production") {
    console.error(
      "[prisma] TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set — DB queries will fail"
    );
  }

  const dbPath = path.join(process.cwd(), "prisma", "dev.db");
  const libsql = createClient({ url: `file:${dbPath}` });
  const adapter = new PrismaLibSql(libsql);
  return new PrismaClient({ adapter } as never);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
