-- CreateTable
CREATE TABLE "ProcedureCatalog" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "procedureType" TEXT NOT NULL,
    "defaultAmount" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProcedureCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientProcedure" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "procedureType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PatientProcedure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcedureCatalog_clinicId_deletedAt_idx" ON "ProcedureCatalog"("clinicId", "deletedAt");

-- CreateIndex
CREATE INDEX "ProcedureCatalog_clinicId_isActive_idx" ON "ProcedureCatalog"("clinicId", "isActive");

-- CreateIndex
CREATE INDEX "PatientProcedure_clinicId_patientId_performedAt_idx" ON "PatientProcedure"("clinicId", "patientId", "performedAt");

-- CreateIndex
CREATE INDEX "PatientProcedure_patientId_deletedAt_performedAt_idx" ON "PatientProcedure"("patientId", "deletedAt", "performedAt");

-- CreateIndex
CREATE INDEX "PatientProcedure_catalogId_idx" ON "PatientProcedure"("catalogId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientProcedure_invoiceId_key" ON "PatientProcedure"("invoiceId");

-- AddForeignKey
ALTER TABLE "ProcedureCatalog" ADD CONSTRAINT "ProcedureCatalog_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProcedure" ADD CONSTRAINT "PatientProcedure_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProcedure" ADD CONSTRAINT "PatientProcedure_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProcedure" ADD CONSTRAINT "PatientProcedure_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "ProcedureCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProcedure" ADD CONSTRAINT "PatientProcedure_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProcedure" ADD CONSTRAINT "PatientProcedure_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
