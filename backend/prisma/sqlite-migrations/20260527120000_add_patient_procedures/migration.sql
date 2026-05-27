CREATE TABLE "ProcedureCatalog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "procedureType" TEXT NOT NULL,
    "defaultAmount" REAL,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "ProcedureCatalog_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PatientProcedure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "procedureType" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "notes" TEXT,
    "performedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "PatientProcedure_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PatientProcedure_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PatientProcedure_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "ProcedureCatalog" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PatientProcedure_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PatientProcedure_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ProcedureCatalog_clinicId_deletedAt_idx" ON "ProcedureCatalog"("clinicId", "deletedAt");
CREATE INDEX "ProcedureCatalog_clinicId_isActive_idx" ON "ProcedureCatalog"("clinicId", "isActive");
CREATE INDEX "PatientProcedure_clinicId_patientId_performedAt_idx" ON "PatientProcedure"("clinicId", "patientId", "performedAt");
CREATE INDEX "PatientProcedure_patientId_deletedAt_performedAt_idx" ON "PatientProcedure"("patientId", "deletedAt", "performedAt");
CREATE INDEX "PatientProcedure_catalogId_idx" ON "PatientProcedure"("catalogId");
CREATE UNIQUE INDEX "PatientProcedure_invoiceId_key" ON "PatientProcedure"("invoiceId");
