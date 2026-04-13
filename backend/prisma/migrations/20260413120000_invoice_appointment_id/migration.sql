-- Invoice.appointmentId exists in schema + billing list includes `appointment`; baseline DB omitted this column.
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;

CREATE INDEX IF NOT EXISTS "Invoice_appointmentId_idx" ON "Invoice"("appointmentId");

ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_appointmentId_fkey";
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
