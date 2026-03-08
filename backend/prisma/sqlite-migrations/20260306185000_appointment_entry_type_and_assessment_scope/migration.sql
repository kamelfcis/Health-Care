-- Add appointment entry type with default EXAM
ALTER TABLE "Appointment" ADD COLUMN "entryType" TEXT NOT NULL DEFAULT 'EXAM';

-- Recreate PatientSpecialtyAssessment to support one assessment per entry type
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_PatientSpecialtyAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL DEFAULT 'EXAM',
    "templateId" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "computed" JSONB,
    "alerts" JSONB,
    "diagnoses" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PatientSpecialtyAssessment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PatientSpecialtyAssessment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PatientSpecialtyAssessment_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "SpecialtyCatalog" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PatientSpecialtyAssessment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SpecialtyTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_PatientSpecialtyAssessment" (
    "id",
    "patientId",
    "clinicId",
    "specialtyId",
    "entryType",
    "templateId",
    "values",
    "computed",
    "alerts",
    "diagnoses",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "patientId",
    "clinicId",
    "specialtyId",
    'EXAM',
    "templateId",
    "values",
    "computed",
    "alerts",
    "diagnoses",
    "createdAt",
    "updatedAt"
FROM "PatientSpecialtyAssessment";

DROP TABLE "PatientSpecialtyAssessment";
ALTER TABLE "new_PatientSpecialtyAssessment" RENAME TO "PatientSpecialtyAssessment";

CREATE INDEX "PatientSpecialtyAssessment_clinicId_idx" ON "PatientSpecialtyAssessment"("clinicId");
CREATE INDEX "PatientSpecialtyAssessment_specialtyId_idx" ON "PatientSpecialtyAssessment"("specialtyId");
CREATE UNIQUE INDEX "PatientSpecialtyAssessment_patientId_specialtyId_entryType_key" ON "PatientSpecialtyAssessment"("patientId", "specialtyId", "entryType");

PRAGMA foreign_keys=ON;
