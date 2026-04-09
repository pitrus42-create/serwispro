import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";
import path from "path";

const adapter = new PrismaLibSql({
  url: `file:${path.join(process.cwd(), "prisma", "dev.db")}`,
});
const prisma = new PrismaClient({ adapter } as never);

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

  // Admin user
  const adminHash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@serwispro.pl" },
    update: {},
    create: {
      firstName: "Adam",
      lastName: "Administrator",
      email: "admin@serwispro.pl",
      passwordHash: adminHash,
      roles: { create: [{ role: "ADMIN" }] },
      permissions: {
        create: {
          canCreateOrders: true,
          canEditAllOrders: true,
          canCloseOrders: true,
          canEditClosedOrders: true,
          canDeleteOrders: true,
          canManageClients: true,
          canViewAnalytics: true,
          canManageTemplates: true,
          canManageVehicles: true,
          canGeneratePdf: true,
          canViewAllCalendar: true,
        },
      },
    },
  });
  console.log(`Admin: ${admin.email}`);

  // Serwisant user
  const serwisantHash = await bcrypt.hash("serwis123", 12);
  const serwisant = await prisma.user.upsert({
    where: { email: "serwisant@serwispro.pl" },
    update: {},
    create: {
      firstName: "Tomasz",
      lastName: "Kowalski",
      email: "serwisant@serwispro.pl",
      passwordHash: serwisantHash,
      roles: { create: [{ role: "SERWISANT" }] },
      permissions: {
        create: {
          canCreateOrders: true,
          canCloseOrders: true,
          canGeneratePdf: true,
          canViewAllCalendar: false,
        },
      },
    },
  });
  console.log(`Serwisant: ${serwisant.email}`);

  // Magazyn user
  const magazynHash = await bcrypt.hash("magazyn123", 12);
  const magazyn = await prisma.user.upsert({
    where: { email: "magazyn@serwispro.pl" },
    update: {},
    create: {
      firstName: "Marek",
      lastName: "Magazynier",
      email: "magazyn@serwispro.pl",
      passwordHash: magazynHash,
      roles: { create: [{ role: "MAGAZYN" }] },
      permissions: {
        create: {
          canCreateOrders: false,
          canCloseOrders: false,
          canGeneratePdf: false,
          canViewAllCalendar: false,
        },
      },
    },
  });
  console.log(`Magazyn: ${magazyn.email}`);

  // Sample clients
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

  // Counters
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

  // Sample orders
  const loc1 = client1.locations[0];
  const loc2 = client2.locations[0];
  const loc3 = client3.locations[0];

  const order1 = await prisma.order.create({
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
      assignments: {
        create: [{ userId: serwisant.id, isLead: true }],
      },
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
      assignments: {
        create: [{ userId: serwisant.id, isLead: true }],
      },
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
      assignments: {
        create: [{ userId: serwisant.id, isLead: true }],
      },
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

  console.log("Orders created");

  // Checklist template
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

  // Stock categories and items
  const cat1 = await prisma.stockCategory.create({
    data: { name: "Akumulatory" },
  });
  const cat2 = await prisma.stockCategory.create({
    data: { name: "Czujki i detektory" },
  });
  const cat3 = await prisma.stockCategory.create({
    data: { name: "Centrale alarmowe" },
  });

  await prisma.stockItem.createMany({
    data: [
      { name: "Akumulator 12V 7Ah", sku: "AKU-12-7", unit: "szt", categoryId: cat1.id },
      { name: "Akumulator 12V 17Ah", sku: "AKU-12-17", unit: "szt", categoryId: cat1.id },
      { name: "Czujka PIR standard", sku: "PIR-STD", unit: "szt", categoryId: cat2.id },
      { name: "Czujka PIR zewnętrzna", sku: "PIR-EXT", unit: "szt", categoryId: cat2.id },
      { name: "Czujka otwarcia magnetyczna", sku: "MAG-STD", unit: "szt", categoryId: cat2.id },
    ],
  });

  // Vehicle
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

  // Update order counters to match created orders
  await prisma.orderCounter.update({
    where: { id: 1 },
    data: { count: 4 },
  });

  console.log("Seed completed successfully!");
  console.log("\nLogin credentials:");
  console.log("  Admin:     admin@serwispro.pl / admin123");
  console.log("  Serwisant: serwisant@serwispro.pl / serwis123");
  console.log("  Magazyn:   magazyn@serwispro.pl / magazyn123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
