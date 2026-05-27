import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

console.log("Seeding Turso...");

const adminHash = await bcrypt.hash("admin123", 12);
const serwisantHash = await bcrypt.hash("serwis123", 12);
const magazynHash = await bcrypt.hash("magazyn123", 12);

const adminId = randomUUID();
const serwisantId = randomUUID();
const magazynId = randomUUID();

// Admin
await client.execute({
  sql: `INSERT OR IGNORE INTO User (id, firstName, lastName, email, passwordHash, isActive, createdAt)
        VALUES (?, 'Adam', 'Administrator', 'admin@serwispro.pl', ?, 1, datetime('now'))`,
  args: [adminId, adminHash],
});
await client.execute({
  sql: `INSERT OR IGNORE INTO UserRole (userId, role) VALUES (?, 'ADMIN')`,
  args: [adminId],
});
await client.execute({
  sql: `INSERT OR IGNORE INTO UserPermission (userId, canCreateOrders, canEditAllOrders, canCloseOrders, canEditClosedOrders, canDeleteOrders, canManageClients, canViewAnalytics, canManageTemplates, canManageVehicles, canGeneratePdf, canViewAllCalendar)
        VALUES (?, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)`,
  args: [adminId],
});

// Serwisant
await client.execute({
  sql: `INSERT OR IGNORE INTO User (id, firstName, lastName, email, passwordHash, isActive, createdAt)
        VALUES (?, 'Tomasz', 'Kowalski', 'serwisant@serwispro.pl', ?, 1, datetime('now'))`,
  args: [serwisantId, serwisantHash],
});
await client.execute({
  sql: `INSERT OR IGNORE INTO UserRole (userId, role) VALUES (?, 'SERWISANT')`,
  args: [serwisantId],
});
await client.execute({
  sql: `INSERT OR IGNORE INTO UserPermission (userId, canCreateOrders, canCloseOrders, canGeneratePdf, canViewAllCalendar)
        VALUES (?, 1, 1, 1, 0)`,
  args: [serwisantId],
});

// Magazyn
await client.execute({
  sql: `INSERT OR IGNORE INTO User (id, firstName, lastName, email, passwordHash, isActive, createdAt)
        VALUES (?, 'Marek', 'Magazynier', 'magazyn@serwispro.pl', ?, 1, datetime('now'))`,
  args: [magazynId, magazynHash],
});
await client.execute({
  sql: `INSERT OR IGNORE INTO UserRole (userId, role) VALUES (?, 'MAGAZYN')`,
  args: [magazynId],
});
await client.execute({
  sql: `INSERT OR IGNORE INTO UserPermission (userId) VALUES (?)`,
  args: [magazynId],
});

// Company settings
await client.execute({
  sql: `INSERT OR IGNORE INTO CompanySettings (id, name, address, phone, email, nip, updatedAt)
        VALUES (1, 'SerwisPro Sp. z o.o.', 'ul. Bezpieczna 1, 00-001 Warszawa', '+48 22 123 45 67', 'biuro@serwispro.pl', '1234567890', datetime('now'))`,
  args: [],
});

// Counters
await client.execute({
  sql: `INSERT OR IGNORE INTO OrderCounter (id, year, count) VALUES (1, strftime('%Y', 'now'), 0)`,
  args: [],
});
await client.execute({
  sql: `INSERT OR IGNORE INTO ProtocolCounter (id, year, count) VALUES (1, strftime('%Y', 'now'), 0)`,
  args: [],
});

console.log("✅ Seed completed!");
console.log("  Admin:     admin@serwispro.pl / admin123");
console.log("  Serwisant: serwisant@serwispro.pl / serwis123");
console.log("  Magazyn:   magazyn@serwispro.pl / magazyn123");

client.close();
