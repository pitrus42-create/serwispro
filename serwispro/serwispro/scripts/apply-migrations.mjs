import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Brak TURSO_DATABASE_URL lub TURSO_AUTH_TOKEN");
  process.exit(1);
}

const db = createClient({ url, authToken });

const migrations = [
  {
    name: "20260427215423_add_unit_price_to_order_material",
    sql: `ALTER TABLE "OrderMaterial" ADD COLUMN "unitPrice" REAL;`,
  },
  {
    name: "20260429203236_add_protocol_global_templates",
    sql: `CREATE TABLE IF NOT EXISTS "ProtocolGlobalTemplate" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "defaultText" TEXT NOT NULL DEFAULT '',
      "defaultChecklist" TEXT NOT NULL DEFAULT '[]',
      "defaultNotes" TEXT NOT NULL DEFAULT '',
      "createdBy" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );`,
  },
];

for (const m of migrations) {
  try {
    await db.execute(m.sql);
    console.log(`✓ ${m.name}`);
  } catch (e) {
    if (e.message?.includes("duplicate column") || e.message?.includes("already exists")) {
      console.log(`  (już istnieje) ${m.name}`);
    } else {
      console.error(`✗ ${m.name}: ${e.message}`);
    }
  }
}

console.log("\nGotowe.");
