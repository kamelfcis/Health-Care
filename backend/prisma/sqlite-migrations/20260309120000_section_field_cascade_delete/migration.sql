PRAGMA foreign_keys=OFF;

CREATE TABLE "new_SpecialtyTemplateField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "sectionId" TEXT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "sectionAr" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL,
    "helpText" TEXT,
    "helpTextAr" TEXT,
    "visibleWhen" JSONB,
    "gridColumns" JSONB,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SpecialtyTemplateField_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SpecialtyTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SpecialtyTemplateField_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "SpecialtyTemplateSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_SpecialtyTemplateField" (
    "id", "templateId", "sectionId", "key", "label", "labelAr", "section", "sectionAr", "fieldType",
    "isRequired", "displayOrder", "helpText", "helpTextAr", "visibleWhen", "gridColumns", "metadata", "createdAt", "updatedAt"
)
SELECT
    "id", "templateId", "sectionId", "key", "label", "labelAr", "section", "sectionAr", "fieldType",
    "isRequired", "displayOrder", "helpText", "helpTextAr", "visibleWhen", "gridColumns", "metadata", "createdAt", "updatedAt"
FROM "SpecialtyTemplateField";

DROP TABLE "SpecialtyTemplateField";
ALTER TABLE "new_SpecialtyTemplateField" RENAME TO "SpecialtyTemplateField";

CREATE UNIQUE INDEX "SpecialtyTemplateField_templateId_key_key" ON "SpecialtyTemplateField"("templateId", "key");
CREATE INDEX "SpecialtyTemplateField_templateId_displayOrder_idx" ON "SpecialtyTemplateField"("templateId", "displayOrder");
CREATE INDEX "SpecialtyTemplateField_section_displayOrder_idx" ON "SpecialtyTemplateField"("section", "displayOrder");
CREATE INDEX "SpecialtyTemplateField_sectionId_idx" ON "SpecialtyTemplateField"("sectionId");

PRAGMA foreign_keys=ON;
