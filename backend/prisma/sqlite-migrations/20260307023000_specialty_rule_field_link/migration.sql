PRAGMA foreign_keys=OFF;

CREATE TABLE "new_SpecialtyRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "fieldId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expression" JSONB NOT NULL,
    "severity" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SpecialtyRule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SpecialtyTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SpecialtyRule_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "SpecialtyTemplateField" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_SpecialtyRule" (
    "id",
    "templateId",
    "fieldId",
    "key",
    "name",
    "nameAr",
    "type",
    "expression",
    "severity",
    "displayOrder",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "templateId",
    NULL,
    "key",
    "name",
    "nameAr",
    "type",
    "expression",
    "severity",
    "displayOrder",
    "createdAt",
    "updatedAt"
FROM "SpecialtyRule";

DROP TABLE "SpecialtyRule";
ALTER TABLE "new_SpecialtyRule" RENAME TO "SpecialtyRule";

CREATE UNIQUE INDEX "SpecialtyRule_templateId_key_key" ON "SpecialtyRule"("templateId", "key");
CREATE INDEX "SpecialtyRule_templateId_type_displayOrder_idx" ON "SpecialtyRule"("templateId", "type", "displayOrder");
CREATE INDEX "SpecialtyRule_fieldId_idx" ON "SpecialtyRule"("fieldId");

PRAGMA foreign_keys=ON;
