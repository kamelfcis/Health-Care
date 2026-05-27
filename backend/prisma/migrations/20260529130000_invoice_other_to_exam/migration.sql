-- Reclassify legacy "OTHER" invoices as EXAM (كشف), except procedure-linked invoices.
UPDATE "Invoice" i
SET "invoiceType" = 'EXAM'
WHERE i."invoiceType" = 'OTHER'
  AND NOT EXISTS (
    SELECT 1 FROM "PatientProcedure" pp
    WHERE pp."invoiceId" = i."id"
  );
