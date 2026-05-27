import "dotenv/config";
import path from "path";
import { defineConfig } from "prisma/config";

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

function getDatasourceUrl(): string {
  if (tursoUrl && tursoToken) {
    return `${tursoUrl}?authToken=${tursoToken}`;
  }
  return `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: getDatasourceUrl(),
  },
});
