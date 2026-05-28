-- Invoice: store payment method chosen when marked paid
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paymentMethodCode" TEXT;

-- Ensure PaymentMethodCatalog exists (idempotent for DBs that never ran prior migration)
CREATE TABLE IF NOT EXISTS "PaymentMethodCatalog" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameAr" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "PaymentMethodCatalog_pkey" PRIMARY KEY ("id")
);

-- Drop global unique on code if present
DROP INDEX IF EXISTS "PaymentMethodCatalog_code_key";

-- Seed per clinic from legacy global rows (clinicId IS NULL) or defaults
INSERT INTO "PaymentMethodCatalog" ("id", "clinicId", "code", "name", "nameAr", "isActive", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || c."id" || d.code),
  c."id",
  d.code,
  d.name,
  d."nameAr",
  true,
  NOW(),
  NOW()
FROM "Clinic" c
CROSS JOIN (
  VALUES
    ('CASH', 'Cash', 'نقدي'),
    ('CARD', 'Card', 'بطاقة'),
    ('ONLINE', 'Online', 'أونلاين'),
    ('INSURANCE', 'Insurance', 'تأمين')
) AS d(code, name, "nameAr")
WHERE NOT EXISTS (
  SELECT 1 FROM "PaymentMethodCatalog" pmc
  WHERE pmc."clinicId" = c."id" AND pmc."deletedAt" IS NULL
);

-- Remove legacy global catalog rows
DELETE FROM "PaymentMethodCatalog" WHERE "clinicId" IS NULL;

-- Enforce required clinicId
ALTER TABLE "PaymentMethodCatalog" ALTER COLUMN "clinicId" SET NOT NULL;

-- Composite unique per clinic
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentMethodCatalog_clinicId_code_key"
  ON "PaymentMethodCatalog"("clinicId", "code");

CREATE INDEX IF NOT EXISTS "PaymentMethodCatalog_clinicId_isActive_deletedAt_idx"
  ON "PaymentMethodCatalog"("clinicId", "isActive", "deletedAt");

-- FK if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentMethodCatalog_clinicId_fkey'
  ) THEN
    ALTER TABLE "PaymentMethodCatalog"
    ADD CONSTRAINT "PaymentMethodCatalog_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
