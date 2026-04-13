-- AlterTable
ALTER TABLE "ClinicCounter" ADD COLUMN IF NOT EXISTS "lastInvoiceSequence" INTEGER NOT NULL DEFAULT 0;
