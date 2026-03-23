-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "VisitEntryType" AS ENUM ('EXAM', 'CONSULTATION');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'ONLINE', 'INSURANCE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "Profession" AS ENUM ('ADMIN_EMPLOYEE', 'FREELANCER', 'DRIVER', 'ENGINEER', 'FACTORY_WORKER', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('FACEBOOK_AD', 'GOOGLE_SEARCH', 'DOCTOR_REFERRAL', 'FRIEND', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'FOLLOW_UP', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "SpecialtyFieldType" AS ENUM ('TEXT', 'TEXT_AREA', 'NUMBER', 'YES_NO', 'DATE', 'DROPDOWN', 'MULTI_SELECT', 'AUTO', 'GRID');

-- CreateEnum
CREATE TYPE "SpecialtyRuleType" AS ENUM ('ALERT', 'DIAGNOSIS', 'COMPUTE');

-- CreateTable
CREATE TABLE "Clinic" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image_url" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "countryCode" TEXT NOT NULL DEFAULT 'US',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medicine" (
    "id" TEXT NOT NULL,
    "arabicName" TEXT NOT NULL,
    "englishName" TEXT NOT NULL,
    "activeIngredient" TEXT NOT NULL,
    "usageMethod" TEXT,
    "specialty" TEXT,
    "dosageForm" TEXT,
    "concentration" TEXT,
    "company" TEXT,
    "warnings" TEXT,
    "drugInteractions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Medicine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "refreshToken" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicUser" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ClinicUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nationalId" TEXT,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "alternatePhone" TEXT,
    "email" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "genderOther" TEXT,
    "nationality" TEXT,
    "nationalityOther" TEXT,
    "country" TEXT,
    "countryOther" TEXT,
    "governorate" TEXT,
    "governorateOther" TEXT,
    "city" TEXT,
    "cityOther" TEXT,
    "maritalStatus" TEXT,
    "maritalStatusOther" TEXT,
    "profession" "Profession" NOT NULL,
    "professionOther" TEXT,
    "occupation" TEXT,
    "leadSource" "LeadSource" NOT NULL,
    "leadSourceOther" TEXT,
    "branch" TEXT,
    "specialtyCode" TEXT,
    "specialtyName" TEXT,
    "clinicName" TEXT,
    "doctorName" TEXT,
    "campaignName" TEXT,
    "referrerName" TEXT,
    "referralType" TEXT,
    "referralTypeOther" TEXT,
    "generalNotes" TEXT,
    "fileNumber" INTEGER NOT NULL,
    "firstVisitDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientExam" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PatientExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientExamAttachment" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientExamAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "specialtyId" TEXT,
    "entryType" "VisitEntryType" NOT NULL DEFAULT 'EXAM',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalRecord" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "treatment" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MedicalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "medicalRecordId" TEXT,
    "medicationName" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "durationDays" INTEGER,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "transactionRef" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "leadSource" "LeadSource" NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "assignedToId" TEXT,
    "createdById" TEXT,
    "convertedPatientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "followUpDate" TIMESTAMP(3) NOT NULL,
    "status" "LeadStatus" NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicCounter" (
    "clinicId" TEXT NOT NULL,
    "lastPatientFileNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClinicCounter_pkey" PRIMARY KEY ("clinicId")
);

-- CreateTable
CREATE TABLE "SpecialtyCatalog" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SpecialtyCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicSpecialty" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ClinicSpecialty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialtyTemplate" (
    "id" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialtyTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialtyTemplateSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialtyTemplateSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialtyTemplateField" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sectionId" TEXT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "sectionAr" TEXT NOT NULL,
    "fieldType" "SpecialtyFieldType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL,
    "helpText" TEXT,
    "helpTextAr" TEXT,
    "visibleWhen" JSONB,
    "gridColumns" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialtyTemplateField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialtyTemplateOption" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialtyTemplateOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialtyRule" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "fieldId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "type" "SpecialtyRuleType" NOT NULL,
    "expression" JSONB NOT NULL,
    "severity" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialtyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientSpecialtyAssessment" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT,
    "patientId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "entryType" "VisitEntryType" NOT NULL DEFAULT 'EXAM',
    "templateId" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "computed" JSONB,
    "alerts" JSONB,
    "diagnoses" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientSpecialtyAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Clinic_clinicId_key" ON "Clinic"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "Clinic_slug_key" ON "Clinic"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Clinic_email_key" ON "Clinic"("email");

-- CreateIndex
CREATE INDEX "Clinic_clinicId_idx" ON "Clinic"("clinicId");

-- CreateIndex
CREATE INDEX "Clinic_slug_idx" ON "Clinic"("slug");

-- CreateIndex
CREATE INDEX "Clinic_deletedAt_createdAt_idx" ON "Clinic"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Medicine_deletedAt_createdAt_idx" ON "Medicine"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Medicine_arabicName_idx" ON "Medicine"("arabicName");

-- CreateIndex
CREATE INDEX "Medicine_englishName_idx" ON "Medicine"("englishName");

-- CreateIndex
CREATE INDEX "Medicine_specialty_idx" ON "Medicine"("specialty");

-- CreateIndex
CREATE INDEX "Medicine_company_idx" ON "Medicine"("company");

-- CreateIndex
CREATE INDEX "Role_clinicId_idx" ON "Role"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_clinicId_name_key" ON "Role"("clinicId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "User_clinicId_idx" ON "User"("clinicId");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_clinicId_email_key" ON "User"("clinicId", "email");

-- CreateIndex
CREATE INDEX "ClinicUser_clinicId_idx" ON "ClinicUser"("clinicId");

-- CreateIndex
CREATE INDEX "ClinicUser_userId_idx" ON "ClinicUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicUser_clinicId_userId_key" ON "ClinicUser"("clinicId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_userId_key" ON "Doctor"("userId");

-- CreateIndex
CREATE INDEX "Doctor_clinicId_idx" ON "Doctor"("clinicId");

-- CreateIndex
CREATE INDEX "Doctor_clinicId_deletedAt_createdAt_idx" ON "Doctor"("clinicId", "deletedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_clinicId_licenseNumber_key" ON "Doctor"("clinicId", "licenseNumber");

-- CreateIndex
CREATE INDEX "Patient_clinicId_idx" ON "Patient"("clinicId");

-- CreateIndex
CREATE INDEX "Patient_clinicId_phone_idx" ON "Patient"("clinicId", "phone");

-- CreateIndex
CREATE INDEX "Patient_clinicId_nationalId_idx" ON "Patient"("clinicId", "nationalId");

-- CreateIndex
CREATE INDEX "Patient_clinicId_fileNumber_idx" ON "Patient"("clinicId", "fileNumber");

-- CreateIndex
CREATE INDEX "Patient_clinicId_deletedAt_createdAt_idx" ON "Patient"("clinicId", "deletedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_clinicId_fileNumber_key" ON "Patient"("clinicId", "fileNumber");

-- CreateIndex
CREATE INDEX "PatientExam_clinicId_patientId_examDate_idx" ON "PatientExam"("clinicId", "patientId", "examDate");

-- CreateIndex
CREATE INDEX "PatientExam_patientId_deletedAt_examDate_idx" ON "PatientExam"("patientId", "deletedAt", "examDate");

-- CreateIndex
CREATE INDEX "PatientExamAttachment_examId_createdAt_idx" ON "PatientExamAttachment"("examId", "createdAt");

-- CreateIndex
CREATE INDEX "PatientExamAttachment_clinicId_createdAt_idx" ON "PatientExamAttachment"("clinicId", "createdAt");

-- CreateIndex
CREATE INDEX "Appointment_clinicId_idx" ON "Appointment"("clinicId");

-- CreateIndex
CREATE INDEX "Appointment_specialtyId_idx" ON "Appointment"("specialtyId");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_startsAt_idx" ON "Appointment"("doctorId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_patientId_startsAt_idx" ON "Appointment"("patientId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_clinicId_deletedAt_createdAt_idx" ON "Appointment"("clinicId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "MedicalRecord_clinicId_idx" ON "MedicalRecord"("clinicId");

-- CreateIndex
CREATE INDEX "MedicalRecord_patientId_createdAt_idx" ON "MedicalRecord"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "Prescription_clinicId_idx" ON "Prescription"("clinicId");

-- CreateIndex
CREATE INDEX "Prescription_patientId_createdAt_idx" ON "Prescription"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_clinicId_idx" ON "Invoice"("clinicId");

-- CreateIndex
CREATE INDEX "Invoice_clinicId_deletedAt_createdAt_idx" ON "Invoice"("clinicId", "deletedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_clinicId_invoiceNumber_key" ON "Invoice"("clinicId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "Payment_clinicId_idx" ON "Payment"("clinicId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_paidAt_idx" ON "Payment"("invoiceId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_clinicId_deletedAt_createdAt_idx" ON "Payment"("clinicId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_clinicId_idx" ON "Notification"("clinicId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Lead_clinicId_createdAt_idx" ON "Lead"("clinicId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_clinicId_status_createdAt_idx" ON "Lead"("clinicId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_clinicId_leadSource_createdAt_idx" ON "Lead"("clinicId", "leadSource", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_assignedToId_idx" ON "Lead"("assignedToId");

-- CreateIndex
CREATE INDEX "FollowUp_leadId_followUpDate_idx" ON "FollowUp"("leadId", "followUpDate");

-- CreateIndex
CREATE INDEX "FollowUp_createdById_idx" ON "FollowUp"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialtyCatalog_code_key" ON "SpecialtyCatalog"("code");

-- CreateIndex
CREATE INDEX "SpecialtyCatalog_isActive_idx" ON "SpecialtyCatalog"("isActive");

-- CreateIndex
CREATE INDEX "ClinicSpecialty_clinicId_idx" ON "ClinicSpecialty"("clinicId");

-- CreateIndex
CREATE INDEX "ClinicSpecialty_specialtyId_idx" ON "ClinicSpecialty"("specialtyId");

-- CreateIndex
CREATE INDEX "ClinicSpecialty_templateId_idx" ON "ClinicSpecialty"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicSpecialty_clinicId_specialtyId_key" ON "ClinicSpecialty"("clinicId", "specialtyId");

-- CreateIndex
CREATE INDEX "SpecialtyTemplate_specialtyId_isActive_idx" ON "SpecialtyTemplate"("specialtyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialtyTemplate_specialtyId_version_key" ON "SpecialtyTemplate"("specialtyId", "version");

-- CreateIndex
CREATE INDEX "SpecialtyTemplateSection_templateId_displayOrder_idx" ON "SpecialtyTemplateSection"("templateId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialtyTemplateSection_templateId_key_key" ON "SpecialtyTemplateSection"("templateId", "key");

-- CreateIndex
CREATE INDEX "SpecialtyTemplateField_templateId_displayOrder_idx" ON "SpecialtyTemplateField"("templateId", "displayOrder");

-- CreateIndex
CREATE INDEX "SpecialtyTemplateField_section_displayOrder_idx" ON "SpecialtyTemplateField"("section", "displayOrder");

-- CreateIndex
CREATE INDEX "SpecialtyTemplateField_sectionId_idx" ON "SpecialtyTemplateField"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialtyTemplateField_templateId_key_key" ON "SpecialtyTemplateField"("templateId", "key");

-- CreateIndex
CREATE INDEX "SpecialtyTemplateOption_fieldId_displayOrder_idx" ON "SpecialtyTemplateOption"("fieldId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialtyTemplateOption_fieldId_value_key" ON "SpecialtyTemplateOption"("fieldId", "value");

-- CreateIndex
CREATE INDEX "SpecialtyRule_templateId_type_displayOrder_idx" ON "SpecialtyRule"("templateId", "type", "displayOrder");

-- CreateIndex
CREATE INDEX "SpecialtyRule_fieldId_idx" ON "SpecialtyRule"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialtyRule_templateId_key_key" ON "SpecialtyRule"("templateId", "key");

-- CreateIndex
CREATE INDEX "PatientSpecialtyAssessment_clinicId_idx" ON "PatientSpecialtyAssessment"("clinicId");

-- CreateIndex
CREATE INDEX "PatientSpecialtyAssessment_specialtyId_idx" ON "PatientSpecialtyAssessment"("specialtyId");

-- CreateIndex
CREATE INDEX "PatientSpecialtyAssessment_patientId_specialtyId_entryType_idx" ON "PatientSpecialtyAssessment"("patientId", "specialtyId", "entryType");

-- CreateIndex
CREATE UNIQUE INDEX "PatientSpecialtyAssessment_appointmentId_key" ON "PatientSpecialtyAssessment"("appointmentId");

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicUser" ADD CONSTRAINT "ClinicUser_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicUser" ADD CONSTRAINT "ClinicUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientExam" ADD CONSTRAINT "PatientExam_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientExam" ADD CONSTRAINT "PatientExam_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientExamAttachment" ADD CONSTRAINT "PatientExamAttachment_examId_fkey" FOREIGN KEY ("examId") REFERENCES "PatientExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientExamAttachment" ADD CONSTRAINT "PatientExamAttachment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "SpecialtyCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRecord" ADD CONSTRAINT "MedicalRecord_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRecord" ADD CONSTRAINT "MedicalRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "MedicalRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedPatientId_fkey" FOREIGN KEY ("convertedPatientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicCounter" ADD CONSTRAINT "ClinicCounter_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicSpecialty" ADD CONSTRAINT "ClinicSpecialty_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicSpecialty" ADD CONSTRAINT "ClinicSpecialty_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "SpecialtyCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicSpecialty" ADD CONSTRAINT "ClinicSpecialty_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SpecialtyTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialtyTemplate" ADD CONSTRAINT "SpecialtyTemplate_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "SpecialtyCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialtyTemplateSection" ADD CONSTRAINT "SpecialtyTemplateSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SpecialtyTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialtyTemplateField" ADD CONSTRAINT "SpecialtyTemplateField_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SpecialtyTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialtyTemplateField" ADD CONSTRAINT "SpecialtyTemplateField_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "SpecialtyTemplateSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialtyTemplateOption" ADD CONSTRAINT "SpecialtyTemplateOption_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "SpecialtyTemplateField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialtyRule" ADD CONSTRAINT "SpecialtyRule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SpecialtyTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialtyRule" ADD CONSTRAINT "SpecialtyRule_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "SpecialtyTemplateField"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientSpecialtyAssessment" ADD CONSTRAINT "PatientSpecialtyAssessment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientSpecialtyAssessment" ADD CONSTRAINT "PatientSpecialtyAssessment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientSpecialtyAssessment" ADD CONSTRAINT "PatientSpecialtyAssessment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientSpecialtyAssessment" ADD CONSTRAINT "PatientSpecialtyAssessment_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "SpecialtyCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientSpecialtyAssessment" ADD CONSTRAINT "PatientSpecialtyAssessment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SpecialtyTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
