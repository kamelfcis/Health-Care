-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ClinicSpecialty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "templateId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "ClinicSpecialty_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClinicSpecialty_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "SpecialtyCatalog" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClinicSpecialty_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SpecialtyTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ClinicSpecialty" ("clinicId", "createdAt", "deletedAt", "id", "specialtyId", "templateId", "updatedAt") SELECT "clinicId", "createdAt", "deletedAt", "id", "specialtyId", "templateId", "updatedAt" FROM "ClinicSpecialty";
DROP TABLE "ClinicSpecialty";
ALTER TABLE "new_ClinicSpecialty" RENAME TO "ClinicSpecialty";
CREATE INDEX "ClinicSpecialty_clinicId_idx" ON "ClinicSpecialty"("clinicId");
CREATE INDEX "ClinicSpecialty_specialtyId_idx" ON "ClinicSpecialty"("specialtyId");
CREATE INDEX "ClinicSpecialty_templateId_idx" ON "ClinicSpecialty"("templateId");
CREATE UNIQUE INDEX "ClinicSpecialty_clinicId_specialtyId_key" ON "ClinicSpecialty"("clinicId", "specialtyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
