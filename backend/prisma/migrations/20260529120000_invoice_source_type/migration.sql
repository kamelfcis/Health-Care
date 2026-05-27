-- CreateEnum
CREATE TYPE "InvoiceSourceType" AS ENUM ('PROCEDURE', 'EXAM', 'CONSULTATION', 'OTHER');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "invoiceType" "InvoiceSourceType" NOT NULL DEFAULT 'OTHER';

-- Backfill: procedure-linked invoices
UPDATE "Invoice" i
SET "invoiceType" = 'PROCEDURE'
WHERE EXISTS (
  SELECT 1 FROM "PatientProcedure" pp
  WHERE pp."invoiceId" = i.id AND pp."deletedAt" IS NULL
);

-- Backfill: exam appointments (not procedure)
UPDATE "Invoice" i
SET "invoiceType" = 'EXAM'
WHERE i."invoiceType" = 'OTHER'
  AND i."appointmentId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "Appointment" a
    WHERE a.id = i."appointmentId" AND a."entryType" = 'EXAM' AND a."deletedAt" IS NULL
  );

-- Backfill: consultation appointments (not procedure)
UPDATE "Invoice" i
SET "invoiceType" = 'CONSULTATION'
WHERE i."invoiceType" = 'OTHER'
  AND i."appointmentId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "Appointment" a
    WHERE a.id = i."appointmentId" AND a."entryType" = 'CONSULTATION' AND a."deletedAt" IS NULL
  );

-- CreateIndex
CREATE INDEX "Invoice_clinicId_invoiceType_idx" ON "Invoice"("clinicId", "invoiceType");
