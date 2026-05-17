-- CreateTable
CREATE TABLE "ProtocolGlobalTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "defaultText" TEXT NOT NULL DEFAULT '',
    "defaultChecklist" TEXT NOT NULL DEFAULT '[]',
    "defaultNotes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
