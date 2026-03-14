CREATE TABLE "PatientExam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "PatientExam_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PatientExam_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PatientExamAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatientExamAttachment_examId_fkey" FOREIGN KEY ("examId") REFERENCES "PatientExam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PatientExamAttachment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PatientExam_clinicId_patientId_examDate_idx" ON "PatientExam"("clinicId", "patientId", "examDate");
CREATE INDEX "PatientExam_patientId_deletedAt_examDate_idx" ON "PatientExam"("patientId", "deletedAt", "examDate");
CREATE INDEX "PatientExamAttachment_examId_createdAt_idx" ON "PatientExamAttachment"("examId", "createdAt");
CREATE INDEX "PatientExamAttachment_clinicId_createdAt_idx" ON "PatientExamAttachment"("clinicId", "createdAt");
