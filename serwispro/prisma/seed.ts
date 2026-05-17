import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";
import path from "path";

const tursoUrl   = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

const adapter = tursoUrl && tursoToken
  ? new PrismaLibSql({ url: tursoUrl, authToken: tursoToken })
  : new PrismaLibSql({ url: `file:${path.join(process.cwd(), "prisma", "dev.db")}` });

const prisma = new PrismaClient({ adapter } as never);

// ─── Permission definitions ────────────────────────────────────────────────────

const PERMISSIONS: Array<{ module: string; action: string; displayName: string }> = [
  { module: "orders",    action: "view",           displayName: "Podgląd zleceń" },
  { module: "orders",    action: "create",         displayName: "Tworzenie zleceń" },
  { module: "orders",    action: "edit",           displayName: "Edycja zleceń" },
  { module: "orders",    action: "delete",         displayName: "Usuwanie zleceń" },
  { module: "orders",    action: "close",          displayName: "Zamykanie zleceń" },
  { module: "orders",    action: "edit_closed",    displayName: "Edycja zamkniętych zleceń" },
  { module: "orders",    action: "export",         displayName: "Eksport zleceń" },
  { module: "orders",    action: "view_all",       displayName: "Podgląd wszystkich zleceń" },
  { module: "clients",   action: "view",           displayName: "Podgląd klientów" },
  { module: "clients",   action: "create",         displayName: "Tworzenie klientów" },
  { module: "clients",   action: "edit",           displayName: "Edycja klientów" },
  { module: "clients",   action: "delete",         displayName: "Usuwanie klientów" },
  { module: "vehicles",  action: "view",           displayName: "Podgląd pojazdów" },
  { module: "vehicles",  action: "manage",         displayName: "Zarządzanie pojazdami" },
  { module: "stock",     action: "view",           displayName: "Podgląd magazynu" },
  { module: "stock",     action: "manage",         displayName: "Zarządzanie magazynem" },
  { module: "stock",     action: "export",         displayName: "Eksport magazynu" },
  { module: "analytics", action: "view",           displayName: "Podgląd analityk" },
  { module: "analytics", action: "export",         displayName: "Eksport analityk" },
  { module: "templates", action: "view",           displayName: "Podgląd szablonów" },
  { module: "templates", action: "manage",         displayName: "Zarządzanie szablonami" },
  { module: "protocols", action: "view",           displayName: "Podgląd protokołów" },
  { module: "protocols", action: "create",         displayName: "Tworzenie protokołów" },
  { module: "protocols", action: "export",         displayName: "Eksport protokołów (PDF)" },
  { module: "calendar",  action: "view",           displayName: "Podgląd kalendarza" },
  { module: "calendar",  action: "view_all",       displayName: "Podgląd całego kalendarza" },
  { module: "users",     action: "view",           displayName: "Podgląd użytkowników" },
  { module: "users",     action: "create",         displayName: "Tworzenie użytkowników" },
  { module: "users",     action: "edit",           displayName: "Edycja użytkowników" },
  { module: "users",     action: "block",          displayName: "Blokowanie użytkowników" },
  { module: "users",     action: "reset_password", displayName: "Reset hasła użytkowników" },
  { module: "users",     action: "delete",         displayName: "Archiwizacja użytkowników" },
  { module: "users",     action: "manage_admins",  displayName: "Zarządzanie administratorami" },
  { module: "settings",  action: "view",           displayName: "Podgląd ustawień" },
  { module: "settings",  action: "manage",         displayName: "Zarządzanie ustawieniami" },
];

// ─── Role → permission set mapping ────────────────────────────────────────────

type PermKey = `${string}:${string}`;

const ROLE_PERMISSIONS: Record<string, PermKey[]> = {
  SUPERADMIN: PERMISSIONS.map((p) => `${p.module}:${p.action}` as PermKey),

  ADMIN: [
    "orders:view", "orders:create", "orders:edit", "orders:delete",
    "orders:close", "orders:edit_closed", "orders:export", "orders:view_all",
    "clients:view", "clients:create", "clients:edit", "clients:delete",
    "vehicles:view", "vehicles:manage",
    "stock:view", "stock:manage", "stock:export",
    "analytics:view", "analytics:export",
    "templates:view", "templates:manage",
    "protocols:view", "protocols:create", "protocols:export",
    "calendar:view", "calendar:view_all",
    "users:view", "users:create", "users:edit", "users:block", "users:reset_password",
    "settings:view", "settings:manage",
  ],

  SZEF: [
    "orders:view", "orders:create", "orders:edit", "orders:delete",
    "orders:close", "orders:edit_closed", "orders:export", "orders:view_all",
    "clients:view", "clients:create", "clients:edit", "clients:delete",
    "vehicles:view", "vehicles:manage",
    "stock:view", "stock:manage", "stock:export",
    "analytics:view", "analytics:export",
    "templates:view", "templates:manage",
    "protocols:view", "protocols:create", "protocols:export",
    "calendar:view", "calendar:view_all",
    "users:view",
  ],

  MENEDZER: [
    "orders:view", "orders:create", "orders:edit", "orders:close",
    "orders:export", "orders:view_all",
    "clients:view", "clients:create", "clients:edit",
    "vehicles:view",
    "stock:view", "stock:export",
    "analytics:view", "analytics:export",
    "templates:view", "templates:manage",
    "protocols:view", "protocols:create", "protocols:export",
    "calendar:view", "calendar:view_all",
  ],

  MAGAZYNIER: [
    "orders:view", "orders:view_all",
    "stock:view", "stock:manage", "stock:export",
    "calendar:view",
  ],

  SERWISANT: [
    "orders:view", "orders:create", "orders:edit", "orders:close",
    "clients:view",
    "vehicles:view",
    "stock:view",
    "templates:view",
    "protocols:view", "protocols:create", "protocols:export",
    "calendar:view",
  ],
};

// ─── Role definitions ──────────────────────────────────────────────────────────

const ROLES = [
  { name: "SUPERADMIN", displayName: "Super Administrator", description: "Pełna kontrola nad systemem. Rola nieusuwalna i niemodyfikowalna." },
  { name: "ADMIN",      displayName: "Administrator",       description: "Zarządzanie operacyjne użytkownikami, zleceniami i ustawieniami." },
  { name: "SZEF",       displayName: "Szef",                description: "Pełen dostęp operacyjny do zleceń i danych firmy." },
  { name: "MENEDZER",   displayName: "Menedżer",            description: "Zarządzanie zleceniami i klientami." },
  { name: "MAGAZYNIER", displayName: "Magazynier",          description: "Obsługa magazynu i podgląd zleceń." },
  { name: "SERWISANT",  displayName: "Serwisant",           description: "Realizacja zleceń serwisowych i tworzenie protokołów." },
];

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding database...");

  // Company settings
  await prisma.companySettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "SerwisPro Sp. z o.o.",
      address: "ul. Bezpieczna 1, 00-001 Warszawa",
      phone: "+48 22 123 45 67",
      email: "biuro@serwispro.pl",
      nip: "1234567890",
    },
  });

  // ── 1. Create all permissions ────────────────────────────────────────────────
  console.log("Creating permissions...");
  const permMap: Record<string, string> = {}; // "module:action" → id

  for (const p of PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { module_action: { module: p.module, action: p.action } },
      update: { displayName: p.displayName },
      create: { module: p.module, action: p.action, displayName: p.displayName },
    });
    permMap[`${p.module}:${p.action}`] = perm.id;
  }
  console.log(`  ${PERMISSIONS.length} permissions ready`);

  // ── 2. Create system roles ───────────────────────────────────────────────────
  console.log("Creating roles...");
  const roleMap: Record<string, string> = {}; // name → id

  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { displayName: r.displayName, description: r.description },
      create: { name: r.name, displayName: r.displayName, description: r.description, isSystem: true },
    });
    roleMap[r.name] = role.id;
  }
  console.log(`  ${ROLES.length} roles ready`);

  // ── 3. Assign permissions to roles ──────────────────────────────────────────
  console.log("Assigning permissions to roles...");
  for (const [roleName, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap[roleName];
    for (const key of permKeys) {
      const permissionId = permMap[key];
      if (!permissionId) {
        console.warn(`  WARN: unknown permission key "${key}" for role ${roleName}`);
        continue;
      }
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId, effect: "ALLOW" },
      });
    }
  }
  console.log("  Role permissions assigned");

  // ── 4. Create users ──────────────────────────────────────────────────────────
  console.log("Creating users...");

  // SuperAdmin
  const superAdminPassword = process.env.SUPERADMIN_PASSWORD ?? "SuperAdmin123!";
  const superAdminHash = await bcrypt.hash(superAdminPassword, 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@serwispro.pl" },
    update: {},
    create: {
      firstName: "Super",
      lastName: "Administrator",
      email: "superadmin@serwispro.pl",
      passwordHash: superAdminHash,
      mustChangePassword: true,
      accountStatus: "ACTIVE",
      isActive: true,
    },
  });
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId: superAdmin.id, roleId: roleMap["SUPERADMIN"] } },
    update: {},
    create: { userId: superAdmin.id, roleId: roleMap["SUPERADMIN"] },
  });
  await prisma.userSettings.upsert({
    where: { userId: superAdmin.id },
    update: {},
    create: { userId: superAdmin.id },
  });
  console.log(`  SuperAdmin: superadmin@serwispro.pl`);

  // Admin
  const adminHash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@serwispro.pl" },
    update: {},
    create: {
      firstName: "Adam",
      lastName: "Administrator",
      email: "admin@serwispro.pl",
      passwordHash: adminHash,
      mustChangePassword: false,
      accountStatus: "ACTIVE",
      isActive: true,
    },
  });
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: roleMap["ADMIN"] } },
    update: {},
    create: { userId: admin.id, roleId: roleMap["ADMIN"] },
  });
  await prisma.userSettings.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id },
  });
  console.log(`  Admin: admin@serwispro.pl`);

  // Serwisant
  const serwisantHash = await bcrypt.hash("serwis123", 12);
  const serwisant = await prisma.user.upsert({
    where: { email: "serwisant@serwispro.pl" },
    update: {},
    create: {
      firstName: "Tomasz",
      lastName: "Kowalski",
      email: "serwisant@serwispro.pl",
      passwordHash: serwisantHash,
      mustChangePassword: false,
      accountStatus: "ACTIVE",
      isActive: true,
      position: "Serwisant senior",
    },
  });
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId: serwisant.id, roleId: roleMap["SERWISANT"] } },
    update: {},
    create: { userId: serwisant.id, roleId: roleMap["SERWISANT"] },
  });
  await prisma.userSettings.upsert({
    where: { userId: serwisant.id },
    update: {},
    create: { userId: serwisant.id },
  });
  console.log(`  Serwisant: serwisant@serwispro.pl`);

  // Magazynier
  const magazynHash = await bcrypt.hash("magazyn123", 12);
  const magazyn = await prisma.user.upsert({
    where: { email: "magazyn@serwispro.pl" },
    update: {},
    create: {
      firstName: "Marek",
      lastName: "Magazynier",
      email: "magazyn@serwispro.pl",
      passwordHash: magazynHash,
      mustChangePassword: false,
      accountStatus: "ACTIVE",
      isActive: true,
      position: "Magazynier",
    },
  });
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId: magazyn.id, roleId: roleMap["MAGAZYNIER"] } },
    update: {},
    create: { userId: magazyn.id, roleId: roleMap["MAGAZYNIER"] },
  });
  await prisma.userSettings.upsert({
    where: { userId: magazyn.id },
    update: {},
    create: { userId: magazyn.id },
  });
  console.log(`  Magazynier: magazyn@serwispro.pl`);

  // ── 5. Sample clients ────────────────────────────────────────────────────────
  const client1 = await prisma.client.upsert({
    where: { id: "client-1" },
    update: {},
    create: {
      id: "client-1",
      name: "ABC Sp. z o.o.",
      type: "FIRMA",
      email: "kontakt@abc.pl",
      phone: "+48 22 500 600 700",
      nip: "9876543210",
      notes: "Klient priorytetowy, umowa serwisowa",
      locations: {
        create: [
          {
            name: "Biuro główne",
            address: "ul. Przemysłowa 10, 02-232 Warszawa",
            systemsNote: "Alarm + CCTV",
            technicalNote: "System DSC + 8 kamer IP",
          },
          {
            name: "Magazyn",
            address: "ul. Logistyczna 5, 05-800 Pruszków",
            systemsNote: "Alarm",
            nextMaintenanceDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        ],
      },
    },
    include: { locations: true },
  });

  const client2 = await prisma.client.upsert({
    where: { id: "client-2" },
    update: {},
    create: {
      id: "client-2",
      name: "Jan Nowak",
      type: "OSOBA_PRYWATNA",
      email: "jan.nowak@gmail.com",
      phone: "+48 601 700 800",
      locations: {
        create: [
          {
            name: "Dom",
            address: "ul. Kwiatowa 3/5, 03-111 Warszawa",
            systemsNote: "Alarm + wideodomofon",
          },
        ],
      },
    },
    include: { locations: true },
  });

  const client3 = await prisma.client.upsert({
    where: { id: "client-3" },
    update: {},
    create: {
      id: "client-3",
      name: "XYZ Market",
      type: "FIRMA",
      phone: "+48 22 900 100 200",
      locations: {
        create: [
          {
            name: "Sklep centrum",
            address: "ul. Handlowa 20, 00-900 Warszawa",
            systemsNote: "Alarm + CCTV + Kontrola dostępu",
            nextMaintenanceDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          },
        ],
      },
    },
    include: { locations: true },
  });
  console.log("Clients created");

  // ── 6. Counters ──────────────────────────────────────────────────────────────
  await prisma.orderCounter.upsert({
    where: { id: 1 },
    update: { year: new Date().getFullYear() },
    create: { id: 1, year: new Date().getFullYear(), count: 0 },
  });
  await prisma.protocolCounter.upsert({
    where: { id: 1 },
    update: { year: new Date().getFullYear() },
    create: { id: 1, year: new Date().getFullYear(), count: 0 },
  });

  // ── 7. Sample orders ─────────────────────────────────────────────────────────
  const loc1 = client1.locations[0];
  const loc2 = client2.locations[0];
  const loc3 = client3.locations[0];

  // Only create orders if they don't exist yet
  const existingOrders = await prisma.order.count();
  if (existingOrders === 0) {
    await prisma.order.create({
      data: {
        orderNumber: "ZL-2026-0001",
        type: "AWARIA",
        status: "PRZYJETE",
        priority: "WYSOKI",
        isCritical: false,
        title: "Awaria centrali alarmowej",
        description: "Centrala nie reaguje na sygnały z czujek, wymaga diagnostyki",
        clientId: client1.id,
        locationId: loc1.id,
        scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        createdById: admin.id,
        assignments: { create: [{ userId: serwisant.id, isLead: true }] },
        activityLog: {
          create: {
            userId: admin.id,
            action: "STATUS_CHANGE",
            details: "Zlecenie utworzone i przyjęte",
          },
        },
      },
    });

    await prisma.order.create({
      data: {
        orderNumber: "ZL-2026-0002",
        type: "KONSERWACJA",
        status: "ZAPLANOWANE",
        priority: "NORMALNY",
        isCritical: false,
        title: "Przegląd systemu CCTV",
        description: "Roczny przegląd systemu monitoringu IP",
        clientId: client1.id,
        locationId: client1.locations[1].id,
        scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        createdById: admin.id,
        assignments: { create: [{ userId: serwisant.id, isLead: true }] },
      },
    });

    await prisma.order.create({
      data: {
        orderNumber: "ZL-2026-0003",
        type: "AWARIA",
        status: "W_TOKU",
        priority: "KRYTYCZNY",
        isCritical: true,
        title: "Brak zasilania systemu alarmowego",
        description: "System nie odpowiada po przerwie w zasilaniu, potrzebna natychmiastowa reakcja",
        clientId: client3.id,
        locationId: loc3.id,
        scheduledAt: new Date(),
        createdById: admin.id,
        assignments: { create: [{ userId: serwisant.id, isLead: true }] },
      },
    });

    await prisma.order.create({
      data: {
        orderNumber: "ZL-2026-0004",
        type: "MONTAZ",
        status: "OCZEKUJACE",
        priority: "NORMALNY",
        isCritical: false,
        title: "Montaż wideodomofonu",
        description: "Instalacja zestawu wideodomofonu IP z tabletem wewnętrznym",
        clientId: client2.id,
        locationId: loc2.id,
        scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdById: admin.id,
      },
    });

    await prisma.orderCounter.update({ where: { id: 1 }, data: { count: 4 } });
    console.log("Orders created");
  } else {
    console.log(`Orders already exist (${existingOrders}), skipping`);
  }

  // ── 8. Checklist templates ───────────────────────────────────────────────────
  const existingTemplates = await prisma.checklistTemplate.count();
  if (existingTemplates === 0) {
    await prisma.checklistTemplate.create({
      data: {
        name: "Przegląd systemu alarmowego",
        orderType: "KONSERWACJA",
        createdBy: admin.id,
        items: {
          create: [
            { text: "Sprawdź stan akumulatora (min. 12V)", itemOrder: 1, isRequired: true },
            { text: "Przetestuj wszystkie czujki PIR", itemOrder: 2, isRequired: true },
            { text: "Przetestuj czujki otwarcia drzwi/okien", itemOrder: 3, isRequired: true },
            { text: "Sprawdź sygnalizatory zewnętrzne i wewnętrzne", itemOrder: 4, isRequired: true },
            { text: "Przetestuj łączność GSM/GPRS", itemOrder: 5, isRequired: false },
            { text: "Sprawdź logi zdarzeń centrali", itemOrder: 6, isRequired: false },
            { text: "Zaktualizuj dane kontaktowe", itemOrder: 7, isRequired: false },
            { text: "Wyczyść obudowy urządzeń", itemOrder: 8, isRequired: false },
          ],
        },
      },
    });

    await prisma.checklistTemplate.create({
      data: {
        name: "Przegląd systemu CCTV",
        orderType: "KONSERWACJA",
        createdBy: admin.id,
        items: {
          create: [
            { text: "Sprawdź obraz wszystkich kamer", itemOrder: 1, isRequired: true },
            { text: "Wyczyść obiektywy kamer", itemOrder: 2, isRequired: true },
            { text: "Sprawdź nagrywanie i playback", itemOrder: 3, isRequired: true },
            { text: "Sprawdź dostępne miejsce na dysku", itemOrder: 4, isRequired: true },
            { text: "Zaktualizuj oprogramowanie rejestratora", itemOrder: 5, isRequired: false },
            { text: "Przetestuj zdalny dostęp", itemOrder: 6, isRequired: false },
          ],
        },
      },
    });

    // Action templates
    await prisma.actionTemplate.create({
      data: {
        name: "Wymiana akumulatora",
        content: "Wymieniono akumulator żelowy 12V 7Ah. Stan starego akumulatora: napięcie pod obciążeniem poniżej normy. Zamontowano nowy akumulator, przeprowadzono test zasilania awaryjnego.",
        category: "NAPRAWA",
        createdBy: admin.id,
      },
    });

    await prisma.actionTemplate.create({
      data: {
        name: "Konfiguracja czujki PIR",
        content: "Dokonano regulacji czułości i kąta detekcji czujki PIR. Przetestowano zadziałanie w warunkach normalnych. Czujka działa prawidłowo.",
        category: "KONFIGURACJA",
        createdBy: admin.id,
      },
    });

    await prisma.actionTemplate.create({
      data: {
        name: "Przegląd standardowy - wynik pozytywny",
        content: "Przeprowadzono pełny przegląd systemu zgodnie z checklistą. Wszystkie elementy działają prawidłowo. System jest sprawny i gotowy do użytkowania. Następny przegląd za 12 miesięcy.",
        category: "PRZEGLAD",
        createdBy: admin.id,
      },
    });
    console.log("Templates created");
  }

  // ── 9. Stock ─────────────────────────────────────────────────────────────────
  const existingCategories = await prisma.stockCategory.count();
  if (existingCategories === 0) {
    const cat1 = await prisma.stockCategory.create({ data: { name: "Akumulatory" } });
    const cat2 = await prisma.stockCategory.create({ data: { name: "Czujki i detektory" } });

    await prisma.stockItem.createMany({
      data: [
        { name: "Akumulator 12V 7Ah",           sku: "AKU-12-7",  unit: "szt", categoryId: cat1.id },
        { name: "Akumulator 12V 17Ah",          sku: "AKU-12-17", unit: "szt", categoryId: cat1.id },
        { name: "Czujka PIR standard",           sku: "PIR-STD",   unit: "szt", categoryId: cat2.id },
        { name: "Czujka PIR zewnętrzna",         sku: "PIR-EXT",   unit: "szt", categoryId: cat2.id },
        { name: "Czujka otwarcia magnetyczna",   sku: "MAG-STD",   unit: "szt", categoryId: cat2.id },
      ],
    });
    console.log("Stock created");
  }

  // ── 10. Vehicle ───────────────────────────────────────────────────────────────
  const existingVehicles = await prisma.vehicle.count();
  if (existingVehicles === 0) {
    await prisma.vehicle.create({
      data: {
        brand: "Ford",
        model: "Transit",
        year: 2022,
        plate: "WX 12345",
        vin: "WF0XXXTTGXXX00001",
        insuranceNumber: "POL-2026-001",
        insuranceExpiry: new Date("2026-12-31"),
        inspectionExpiry: new Date("2027-03-15"),
        notes: "Główny samochód serwisowy",
      },
    });
    console.log("Vehicle created");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\nSeed completed successfully!");
  console.log("\nLogin credentials:");
  console.log("  SuperAdmin: superadmin@serwispro.pl / " + superAdminPassword);
  console.log("  Admin:      admin@serwispro.pl / admin123");
  console.log("  Serwisant:  serwisant@serwispro.pl / serwis123");
  console.log("  Magazynier: magazyn@serwispro.pl / magazyn123");
  if (!process.env.SUPERADMIN_PASSWORD) {
    console.log("\n  ⚠ SUPERADMIN_PASSWORD not set — using default. Set it in .env for production!");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
