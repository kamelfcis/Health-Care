CREATE TYPE "InvoiceLineType" AS ENUM ('PROCEDURE', 'EXAM', 'CONSULTATION', 'OTHER');

CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "lineType" "InvoiceLineType" NOT NULL,
    "catalogProcedureId" TEXT,
    "title" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineSubtotal" DOUBLE PRECISION NOT NULL,
    "lineTax" DOUBLE PRECISION NOT NULL,
    "lineTotal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvoiceLineItem_clinicId_invoiceId_idx" ON "InvoiceLineItem"("clinicId", "invoiceId");
CREATE INDEX "InvoiceLineItem_invoiceId_deletedAt_idx" ON "InvoiceLineItem"("invoiceId", "deletedAt");
CREATE INDEX "InvoiceLineItem_clinicId_lineType_deletedAt_idx" ON "InvoiceLineItem"("clinicId", "lineType", "deletedAt");
CREATE INDEX "InvoiceLineItem_catalogProcedureId_idx" ON "InvoiceLineItem"("catalogProcedureId");

ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_clinicId_fkey"
FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_catalogProcedureId_fkey"
FOREIGN KEY ("catalogProcedureId") REFERENCES "ProcedureCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "InvoiceLineItem" (
  "id",
  "clinicId",
  "invoiceId",
  "lineType",
  "title",
  "quantity",
  "unitPrice",
  "discountPercent",
  "taxPercent",
  "lineSubtotal",
  "lineTax",
  "lineTotal",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text || i."id"),
  i."clinicId",
  i."id",
  CASE i."invoiceType"
    WHEN 'PROCEDURE' THEN 'PROCEDURE'::"InvoiceLineType"
    WHEN 'EXAM' THEN 'EXAM'::"InvoiceLineType"
    WHEN 'CONSULTATION' THEN 'CONSULTATION'::"InvoiceLineType"
    ELSE 'OTHER'::"InvoiceLineType"
  END,
  COALESCE(NULLIF(i."notes", ''), i."invoiceNumber"),
  1,
  GREATEST(0, i."amount"),
  CASE WHEN i."amount" > 0 THEN LEAST(100, GREATEST(0, (i."discount" / i."amount") * 100.0)) ELSE 0 END,
  CASE WHEN (i."amount" - i."discount") > 0 THEN LEAST(100, GREATEST(0, (i."taxAmount" / NULLIF(i."amount" - i."discount", 0)) * 100.0)) ELSE 0 END,
  GREATEST(0, i."amount"),
  GREATEST(0, i."taxAmount"),
  GREATEST(0, i."amount" + i."taxAmount" - i."discount"),
  i."createdAt",
  i."updatedAt"
FROM "Invoice" i
WHERE i."deletedAt" IS NULL;
