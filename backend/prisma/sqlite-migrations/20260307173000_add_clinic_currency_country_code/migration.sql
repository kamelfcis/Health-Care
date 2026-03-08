-- Add per-clinic country/currency settings.
ALTER TABLE "Clinic" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'US';
ALTER TABLE "Clinic" ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'USD';
