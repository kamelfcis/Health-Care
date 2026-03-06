-- CreateTable
CREATE TABLE "SpecialtyCatalog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ClinicSpecialty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "ClinicSpecialty_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClinicSpecialty_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "SpecialtyCatalog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpecialtyTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "specialtyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SpecialtyTemplate_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "SpecialtyCatalog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpecialtyTemplateField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "sectionAr" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL,
    "helpText" TEXT,
    "helpTextAr" TEXT,
    "visibleWhen" JSONB,
    "gridColumns" JSONB,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SpecialtyTemplateField_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SpecialtyTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpecialtyTemplateOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SpecialtyTemplateOption_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "SpecialtyTemplateField" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpecialtyRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expression" JSONB NOT NULL,
    "severity" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SpecialtyRule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SpecialtyTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PatientSpecialtyAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "SpecialtyCatalog_code_key" ON "SpecialtyCatalog"("code");

-- CreateIndex
CREATE INDEX "SpecialtyCatalog_isActive_idx" ON "SpecialtyCatalog"("isActive");

-- CreateIndex
CREATE INDEX "ClinicSpecialty_clinicId_idx" ON "ClinicSpecialty"("clinicId");

-- CreateIndex
CREATE INDEX "ClinicSpecialty_specialtyId_idx" ON "ClinicSpecialty"("specialtyId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicSpecialty_clinicId_specialtyId_key" ON "ClinicSpecialty"("clinicId", "specialtyId");

-- CreateIndex
CREATE INDEX "SpecialtyTemplate_specialtyId_isActive_idx" ON "SpecialtyTemplate"("specialtyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialtyTemplate_specialtyId_version_key" ON "SpecialtyTemplate"("specialtyId", "version");

-- CreateIndex
CREATE INDEX "SpecialtyTemplateField_templateId_displayOrder_idx" ON "SpecialtyTemplateField"("templateId", "displayOrder");

-- CreateIndex
CREATE INDEX "SpecialtyTemplateField_section_displayOrder_idx" ON "SpecialtyTemplateField"("section", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialtyTemplateField_templateId_key_key" ON "SpecialtyTemplateField"("templateId", "key");

-- CreateIndex
CREATE INDEX "SpecialtyTemplateOption_fieldId_displayOrder_idx" ON "SpecialtyTemplateOption"("fieldId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialtyTemplateOption_fieldId_value_key" ON "SpecialtyTemplateOption"("fieldId", "value");

-- CreateIndex
CREATE INDEX "SpecialtyRule_templateId_type_displayOrder_idx" ON "SpecialtyRule"("templateId", "type", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialtyRule_templateId_key_key" ON "SpecialtyRule"("templateId", "key");

-- CreateIndex
CREATE INDEX "PatientSpecialtyAssessment_clinicId_idx" ON "PatientSpecialtyAssessment"("clinicId");

-- CreateIndex
CREATE INDEX "PatientSpecialtyAssessment_specialtyId_idx" ON "PatientSpecialtyAssessment"("specialtyId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientSpecialtyAssessment_patientId_specialtyId_key" ON "PatientSpecialtyAssessment"("patientId", "specialtyId");
