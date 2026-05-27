-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('UTILITIES', 'RENT', 'SALARIES', 'SUPPLIES', 'MAINTENANCE', 'MARKETING', 'OTHER');

-- CreateTable
CREATE TABLE "ClinicExpense" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ClinicExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClinicExpense_clinicId_expenseDate_idx" ON "ClinicExpense"("clinicId", "expenseDate");

-- CreateIndex
CREATE INDEX "ClinicExpense_clinicId_deletedAt_createdAt_idx" ON "ClinicExpense"("clinicId", "deletedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "ClinicExpense" ADD CONSTRAINT "ClinicExpense_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicExpense" ADD CONSTRAINT "ClinicExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
