-- Add clinic-specific template assignment for each clinic specialty.
ALTER TABLE "ClinicSpecialty" ADD COLUMN "templateId" TEXT;

-- Backfill from currently active template per specialty (latest version wins).
UPDATE "ClinicSpecialty"
SET "templateId" = (
  SELECT "st"."id"
  FROM "SpecialtyTemplate" AS "st"
  WHERE "st"."specialtyId" = "ClinicSpecialty"."specialtyId"
    AND "st"."isActive" = 1
  ORDER BY "st"."version" DESC
  LIMIT 1
)
WHERE "templateId" IS NULL;

CREATE INDEX "ClinicSpecialty_templateId_idx" ON "ClinicSpecialty"("templateId");

