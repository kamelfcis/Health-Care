-- Create sections table
CREATE TABLE "SpecialtyTemplateSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SpecialtyTemplateSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SpecialtyTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SpecialtyTemplateSection_templateId_key_key" ON "SpecialtyTemplateSection"("templateId", "key");
CREATE INDEX "SpecialtyTemplateSection_templateId_displayOrder_idx" ON "SpecialtyTemplateSection"("templateId", "displayOrder");

-- Backfill sections from existing template fields
INSERT INTO "SpecialtyTemplateSection" ("id", "templateId", "key", "name", "nameAr", "displayOrder", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(16))),
    "templateId",
    lower(replace(trim("section"), ' ', '_')),
    trim("section"),
    trim("sectionAr"),
    row_number() OVER (
      PARTITION BY "templateId"
      ORDER BY MIN("displayOrder"), trim("section"), trim("sectionAr")
    ),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "SpecialtyTemplateField"
GROUP BY "templateId", trim("section"), trim("sectionAr");

-- Recreate field table to add sectionId relation
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
    CONSTRAINT "SpecialtyTemplateField_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "SpecialtyTemplateSection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_SpecialtyTemplateField" (
    "id", "templateId", "sectionId", "key", "label", "labelAr", "section", "sectionAr", "fieldType",
    "isRequired", "displayOrder", "helpText", "helpTextAr", "visibleWhen", "gridColumns", "metadata", "createdAt", "updatedAt"
)
SELECT
    f."id",
    f."templateId",
    s."id",
    f."key",
    f."label",
    f."labelAr",
    f."section",
    f."sectionAr",
    f."fieldType",
    f."isRequired",
    f."displayOrder",
    f."helpText",
    f."helpTextAr",
    f."visibleWhen",
    f."gridColumns",
    f."metadata",
    f."createdAt",
    f."updatedAt"
FROM "SpecialtyTemplateField" f
LEFT JOIN "SpecialtyTemplateSection" s
  ON s."templateId" = f."templateId"
 AND trim(s."name") = trim(f."section")
 AND trim(s."nameAr") = trim(f."sectionAr");

DROP TABLE "SpecialtyTemplateField";
ALTER TABLE "new_SpecialtyTemplateField" RENAME TO "SpecialtyTemplateField";

CREATE UNIQUE INDEX "SpecialtyTemplateField_templateId_key_key" ON "SpecialtyTemplateField"("templateId", "key");
CREATE INDEX "SpecialtyTemplateField_templateId_displayOrder_idx" ON "SpecialtyTemplateField"("templateId", "displayOrder");
CREATE INDEX "SpecialtyTemplateField_section_displayOrder_idx" ON "SpecialtyTemplateField"("section", "displayOrder");
CREATE INDEX "SpecialtyTemplateField_sectionId_idx" ON "SpecialtyTemplateField"("sectionId");

PRAGMA foreign_keys=ON;
