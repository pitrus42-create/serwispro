-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'company',
    "name" TEXT,
    "nip" TEXT,
    "phone" TEXT,
    "phoneAlt" TEXT,
    "email" TEXT,
    "alias" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Client" ("alias", "createdAt", "email", "id", "isActive", "name", "nip", "notes", "phone", "phoneAlt", "type", "updatedAt") SELECT "alias", "createdAt", "email", "id", "isActive", "name", "nip", "notes", "phone", "phoneAlt", "type", "updatedAt" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE TABLE "new_CompanySettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "nip" TEXT,
    "logoUrl" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CompanySettings" ("address", "email", "id", "logoUrl", "name", "nip", "phone", "updatedAt") SELECT "address", "email", "id", "logoUrl", "name", "nip", "phone", "updatedAt" FROM "CompanySettings";
DROP TABLE "CompanySettings";
ALTER TABLE "new_CompanySettings" RENAME TO "CompanySettings";
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OCZEKUJACE',
    "priority" TEXT NOT NULL DEFAULT 'NORMALNY',
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT,
    "locationId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "internalNotes" TEXT,
    "scheduledAt" DATETIME,
    "scheduledEndAt" DATETIME,
    "dayOrder" INTEGER,
    "completedAt" DATETIME,
    "isSettled" BOOLEAN NOT NULL DEFAULT false,
    "settledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("clientId", "completedAt", "createdAt", "createdById", "dayOrder", "description", "id", "internalNotes", "isCritical", "locationId", "orderNumber", "priority", "scheduledAt", "scheduledEndAt", "status", "title", "type", "updatedAt") SELECT "clientId", "completedAt", "createdAt", "createdById", "dayOrder", "description", "id", "internalNotes", "isCritical", "locationId", "orderNumber", "priority", "scheduledAt", "scheduledEndAt", "status", "title", "type", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE TABLE "new_OrderCounter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "year" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_OrderCounter" ("count", "id", "year") SELECT "count", "id", "year" FROM "OrderCounter";
DROP TABLE "OrderCounter";
ALTER TABLE "new_OrderCounter" RENAME TO "OrderCounter";
CREATE TABLE "new_ProtocolCounter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "year" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_ProtocolCounter" ("count", "id", "year") SELECT "count", "id", "year" FROM "ProtocolCounter";
DROP TABLE "ProtocolCounter";
ALTER TABLE "new_ProtocolCounter" RENAME TO "ProtocolCounter";
CREATE TABLE "new_Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Role" ("createdAt", "description", "displayName", "id", "isCustom", "isSystem", "name", "updatedAt") SELECT "createdAt", "description", "displayName", "id", "isCustom", "isSystem", "name", "updatedAt" FROM "Role";
DROP TABLE "Role";
ALTER TABLE "new_Role" RENAME TO "Role";
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
