CREATE TABLE "Medicine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "arabicName" TEXT NOT NULL,
    "englishName" TEXT NOT NULL,
    "activeIngredient" TEXT NOT NULL,
    "usageMethod" TEXT,
    "specialty" TEXT,
    "dosageForm" TEXT,
    "concentration" TEXT,
    "company" TEXT,
    "warnings" TEXT,
    "drugInteractions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Medicine_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Medicine_clinicId_deletedAt_createdAt_idx" ON "Medicine"("clinicId", "deletedAt", "createdAt");
CREATE INDEX "Medicine_clinicId_arabicName_idx" ON "Medicine"("clinicId", "arabicName");
CREATE INDEX "Medicine_clinicId_englishName_idx" ON "Medicine"("clinicId", "englishName");
CREATE INDEX "Medicine_clinicId_specialty_idx" ON "Medicine"("clinicId", "specialty");
CREATE INDEX "Medicine_clinicId_company_idx" ON "Medicine"("clinicId", "company");
