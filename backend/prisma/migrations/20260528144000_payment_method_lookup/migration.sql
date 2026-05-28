-- Convert payment method from enum to text for lookup-driven methods
ALTER TABLE "Payment"
ALTER COLUMN "method" TYPE TEXT
USING "method"::TEXT;

-- Drop enum type when no longer used
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentMethod') THEN
    DROP TYPE "PaymentMethod";
  END IF;
END $$;

-- Create payment method lookup catalog
CREATE TABLE "PaymentMethodCatalog" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameAr" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "PaymentMethodCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentMethodCatalog_code_key" ON "PaymentMethodCatalog"("code");
CREATE INDEX "PaymentMethodCatalog_isActive_deletedAt_idx" ON "PaymentMethodCatalog"("isActive", "deletedAt");

ALTER TABLE "PaymentMethodCatalog"
ADD CONSTRAINT "PaymentMethodCatalog_clinicId_fkey"
FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default global methods
INSERT INTO "PaymentMethodCatalog" ("id", "clinicId", "code", "name", "nameAr", "isActive", "createdAt", "updatedAt")
VALUES
  (md5(random()::text || clock_timestamp()::text || 'CASH'), NULL, 'CASH', 'Cash', 'نقدي', true, NOW(), NOW()),
  (md5(random()::text || clock_timestamp()::text || 'CARD'), NULL, 'CARD', 'Card', 'بطاقة', true, NOW(), NOW()),
  (md5(random()::text || clock_timestamp()::text || 'ONLINE'), NULL, 'ONLINE', 'Online', 'إلكتروني', true, NOW(), NOW()),
  (md5(random()::text || clock_timestamp()::text || 'INSURANCE'), NULL, 'INSURANCE', 'Insurance', 'تأمين', true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;
