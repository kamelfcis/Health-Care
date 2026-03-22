-- Revoke pharmacy mutation permissions from ClinicAdmin (all clinics)
DELETE FROM "RolePermission"
WHERE "roleId" IN (SELECT "id" FROM "Role" WHERE "name" = 'ClinicAdmin')
  AND "permissionId" IN (
    SELECT "id" FROM "Permission"
    WHERE "key" IN ('pharmacy.create', 'pharmacy.edit', 'pharmacy.delete', 'pharmacy.import')
  );

-- Redefine Medicine without clinicId (global SaaS catalog)
PRAGMA foreign_keys=OFF;

CREATE TABLE "Medicine_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "deletedAt" DATETIME
);

INSERT INTO "Medicine_new" (
    "id",
    "arabicName",
    "englishName",
    "activeIngredient",
    "usageMethod",
    "specialty",
    "dosageForm",
    "concentration",
    "company",
    "warnings",
    "drugInteractions",
    "createdAt",
    "updatedAt",
    "deletedAt"
)
SELECT
    "id",
    "arabicName",
    "englishName",
    "activeIngredient",
    "usageMethod",
    "specialty",
    "dosageForm",
    "concentration",
    "company",
    "warnings",
    "drugInteractions",
    "createdAt",
    "updatedAt",
    "deletedAt"
FROM "Medicine";

DROP TABLE "Medicine";
ALTER TABLE "Medicine_new" RENAME TO "Medicine";

PRAGMA foreign_keys=ON;

CREATE INDEX "Medicine_deletedAt_createdAt_idx" ON "Medicine"("deletedAt", "createdAt");
CREATE INDEX "Medicine_arabicName_idx" ON "Medicine"("arabicName");
CREATE INDEX "Medicine_englishName_idx" ON "Medicine"("englishName");
CREATE INDEX "Medicine_specialty_idx" ON "Medicine"("specialty");
CREATE INDEX "Medicine_company_idx" ON "Medicine"("company");
