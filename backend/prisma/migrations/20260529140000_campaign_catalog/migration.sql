-- Per-clinic campaign lookup; backfill from legacy Patient.campaignName

CREATE TABLE "CampaignCatalog" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameAr" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CampaignCatalog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Patient" ADD COLUMN "campaignId" TEXT;

-- Distinct non-empty campaign names per clinic
INSERT INTO "CampaignCatalog" ("id", "clinicId", "name", "nameAr", "isActive", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || d."clinicId" || d.name),
  d."clinicId",
  d.name,
  d.name,
  true,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT p."clinicId", trim(p."campaignName") AS name
  FROM "Patient" p
  WHERE p."campaignName" IS NOT NULL AND trim(p."campaignName") <> ''
) AS d;

UPDATE "Patient" p
SET "campaignId" = cc."id"
FROM "CampaignCatalog" cc
WHERE p."clinicId" = cc."clinicId"
  AND p."campaignName" IS NOT NULL
  AND trim(p."campaignName") = cc."name"
  AND cc."deletedAt" IS NULL;

ALTER TABLE "Patient" DROP COLUMN "campaignName";

CREATE UNIQUE INDEX "CampaignCatalog_clinicId_name_key" ON "CampaignCatalog"("clinicId", "name");
CREATE INDEX "CampaignCatalog_clinicId_isActive_deletedAt_idx" ON "CampaignCatalog"("clinicId", "isActive", "deletedAt");
CREATE INDEX "Patient_campaignId_idx" ON "Patient"("campaignId");

ALTER TABLE "CampaignCatalog"
  ADD CONSTRAINT "CampaignCatalog_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Patient"
  ADD CONSTRAINT "Patient_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "CampaignCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
