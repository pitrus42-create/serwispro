import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function upsert(sql, args = []) {
  try {
    await db.execute({ sql, args });
  } catch (e) {
    if (!e.message.includes("UNIQUE constraint")) throw e;
  }
}

// ── Permissions ───────────────────────────────────────────────────────────────
const PERMS = [
  ["orders","view","Podgląd zleceń"],["orders","create","Tworzenie zleceń"],
  ["orders","edit","Edycja zleceń"],["orders","delete","Usuwanie zleceń"],
  ["orders","close","Zamykanie zleceń"],["orders","edit_closed","Edycja zamkniętych zleceń"],
  ["orders","export","Eksport zleceń"],["orders","view_all","Podgląd wszystkich zleceń"],
  ["clients","view","Podgląd klientów"],["clients","create","Tworzenie klientów"],
  ["clients","edit","Edycja klientów"],["clients","delete","Usuwanie klientów"],
  ["vehicles","view","Podgląd pojazdów"],["vehicles","manage","Zarządzanie pojazdami"],
  ["stock","view","Podgląd magazynu"],["stock","manage","Zarządzanie magazynem"],
  ["stock","export","Eksport magazynu"],["analytics","view","Podgląd analityk"],
  ["analytics","export","Eksport analityk"],["templates","view","Podgląd szablonów"],
  ["templates","manage","Zarządzanie szablonami"],["protocols","view","Podgląd protokołów"],
  ["protocols","create","Tworzenie protokołów"],["protocols","export","Eksport protokołów (PDF)"],
  ["calendar","view","Podgląd kalendarza"],["calendar","view_all","Podgląd całego kalendarza"],
  ["users","view","Podgląd użytkowników"],["users","create","Tworzenie użytkowników"],
  ["users","edit","Edycja użytkowników"],["users","block","Blokowanie użytkowników"],
  ["users","reset_password","Reset hasła użytkowników"],["users","delete","Archiwizacja użytkowników"],
  ["users","manage_admins","Zarządzanie administratorami"],
  ["settings","view","Podgląd ustawień"],["settings","manage","Zarządzanie ustawieniami"],
];

console.log("Creating permissions...");
const permMap = {};
for (const [module, action, displayName] of PERMS) {
  await upsert(
    `INSERT OR IGNORE INTO Permission (id, module, action, displayName) VALUES (?, ?, ?, ?)`,
    [randomUUID(), module, action, displayName]
  );
  const r = await db.execute({ sql: `SELECT id FROM Permission WHERE module=? AND action=?`, args: [module, action] });
  permMap[`${module}:${action}`] = r.rows[0].id;
}
console.log(`  ${PERMS.length} permissions ready`);

// ── Roles ─────────────────────────────────────────────────────────────────────
const ALL_KEYS = PERMS.map(([m, a]) => `${m}:${a}`);
const ROLE_PERMS = {
  SUPERADMIN: ALL_KEYS,
  ADMIN: ["orders:view","orders:create","orders:edit","orders:delete","orders:close","orders:edit_closed","orders:export","orders:view_all","clients:view","clients:create","clients:edit","clients:delete","vehicles:view","vehicles:manage","stock:view","stock:manage","stock:export","analytics:view","analytics:export","templates:view","templates:manage","protocols:view","protocols:create","protocols:export","calendar:view","calendar:view_all","users:view","users:create","users:edit","users:block","users:reset_password","users:delete","settings:view","settings:manage"],
  SZEF: ["orders:view","orders:create","orders:edit","orders:delete","orders:close","orders:edit_closed","orders:export","orders:view_all","clients:view","clients:create","clients:edit","clients:delete","vehicles:view","vehicles:manage","stock:view","stock:manage","stock:export","analytics:view","analytics:export","templates:view","templates:manage","protocols:view","protocols:create","protocols:export","calendar:view","calendar:view_all","users:view"],
  MENEDZER: ["orders:view","orders:create","orders:edit","orders:close","orders:export","orders:view_all","clients:view","clients:create","clients:edit","vehicles:view","stock:view","stock:export","analytics:view","analytics:export","templates:view","templates:manage","protocols:view","protocols:create","protocols:export","calendar:view","calendar:view_all"],
  MAGAZYNIER: ["orders:view","orders:view_all","stock:view","stock:manage","stock:export","calendar:view"],
  SERWISANT: ["orders:view","orders:create","orders:edit","orders:close","clients:view","vehicles:view","stock:view","templates:view","protocols:view","protocols:create","protocols:export","calendar:view"],
};

const ROLES = [
  ["SUPERADMIN","Super Administrator","Pełna kontrola nad systemem.",1],
  ["ADMIN","Administrator","Zarządzanie operacyjne.",1],
  ["SZEF","Szef","Pełen dostęp operacyjny.",1],
  ["MENEDZER","Menedżer","Zarządzanie zleceniami i klientami.",1],
  ["MAGAZYNIER","Magazynier","Obsługa magazynu.",1],
  ["SERWISANT","Serwisant","Realizacja zleceń serwisowych.",1],
];

console.log("Creating roles...");
const roleMap = {};
for (const [name, displayName, description, isSystem] of ROLES) {
  await upsert(
    `INSERT OR IGNORE INTO Role (id, name, displayName, description, isSystem, updatedAt) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [randomUUID(), name, displayName, description, isSystem]
  );
  const r = await db.execute({ sql: `SELECT id FROM Role WHERE name=?`, args: [name] });
  roleMap[name] = r.rows[0].id;
}
console.log("  6 roles ready");

// ── Role permissions ──────────────────────────────────────────────────────────
console.log("Assigning permissions to roles...");
for (const [roleName, keys] of Object.entries(ROLE_PERMS)) {
  for (const key of keys) {
    const pid = permMap[key];
    if (!pid) { console.warn("  WARN: unknown key", key); continue; }
    await upsert(
      `INSERT OR IGNORE INTO RolePermission (id, roleId, permissionId, effect) VALUES (?, ?, ?, 'ALLOW')`,
      [randomUUID(), roleMap[roleName], pid]
    );
  }
}
console.log("  Done");

// ── Users ─────────────────────────────────────────────────────────────────────
console.log("Setting up users...");

// Set accountStatus on all existing users
await db.execute(`UPDATE User SET accountStatus='ACTIVE' WHERE accountStatus IS NULL OR accountStatus=''`);

async function assignRole(email, roleName) {
  const u = await db.execute({ sql: `SELECT id FROM User WHERE email=?`, args: [email] });
  if (!u.rows.length) { console.log("  User not found:", email); return; }
  const userId = u.rows[0].id;
  const roleId = roleMap[roleName];
  await upsert(`INSERT OR IGNORE INTO UserRoleAssignment (id, userId, roleId) VALUES (?, ?, ?)`, [randomUUID(), userId, roleId]);
  await upsert(`INSERT OR IGNORE INTO UserSettings (userId) VALUES (?)`, [userId]);
  console.log(" ", email, "->", roleName);
}

await assignRole("admin@serwispro.pl", "ADMIN");
await assignRole("serwisant@serwispro.pl", "SERWISANT");
await assignRole("magazyn@serwispro.pl", "MAGAZYNIER");
await assignRole("pitrus42@gmail.com", "ADMIN");
await assignRole("skrzynka.piotrmajewski@gmail.com", "SERWISANT");

// SuperAdmin
const existing = await db.execute({ sql: `SELECT id FROM User WHERE email=?`, args: ["superadmin@serwispro.pl"] });
if (!existing.rows.length) {
  const hash = await bcrypt.hash("SuperAdmin123!", 12);
  const id = randomUUID();
  await db.execute({
    sql: `INSERT INTO User (id, firstName, lastName, email, passwordHash, mustChangePassword, accountStatus, isActive, createdAt) VALUES (?, 'Super', 'Administrator', 'superadmin@serwispro.pl', ?, 1, 'ACTIVE', 1, datetime('now'))`,
    args: [id, hash],
  });
  await upsert(`INSERT OR IGNORE INTO UserRoleAssignment (id, userId, roleId) VALUES (?, ?, ?)`, [randomUUID(), id, roleMap["SUPERADMIN"]]);
  await upsert(`INSERT OR IGNORE INTO UserSettings (userId) VALUES (?)`, [id]);
  console.log("  superadmin@serwispro.pl created (mustChangePassword=true)");
} else {
  await upsert(`INSERT OR IGNORE INTO UserRoleAssignment (id, userId, roleId) VALUES (?, ?, ?)`, [randomUUID(), existing.rows[0].id, roleMap["SUPERADMIN"]]);
  await upsert(`INSERT OR IGNORE INTO UserSettings (userId) VALUES (?)`, [existing.rows[0].id]);
  console.log("  superadmin@serwispro.pl already exists");
}

// ── Verify ────────────────────────────────────────────────────────────────────
const c = await db.execute(`SELECT
  (SELECT count(*) FROM Role) as roles,
  (SELECT count(*) FROM Permission) as perms,
  (SELECT count(*) FROM UserRoleAssignment) as assignments,
  (SELECT count(*) FROM RolePermission) as rolePerms`);
console.log("\nVerification:", JSON.stringify(c.rows[0]));
console.log("\n✅ Turso seed complete!");
console.log("\nLogin credentials:");
console.log("  admin@serwispro.pl / admin123");
console.log("  serwisant@serwispro.pl / serwis123");
console.log("  magazyn@serwispro.pl / magazyn123");
console.log("  superadmin@serwispro.pl / SuperAdmin123! (must change password)");
db.close();
