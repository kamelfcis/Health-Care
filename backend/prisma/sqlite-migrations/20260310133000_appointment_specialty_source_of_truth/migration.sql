PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "specialtyId" TEXT,
    "entryType" TEXT NOT NULL DEFAULT 'EXAM',
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Appointment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "SpecialtyCatalog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Appointment" (
    "id",
    "clinicId",
    "doctorId",
    "patientId",
    "specialtyId",
    "entryType",
    "startsAt",
    "endsAt",
    "reason",
    "notes",
    "status",
    "createdAt",
    "updatedAt",
    "deletedAt"
)
SELECT
    a."id",
    a."clinicId",
    a."doctorId",
    a."patientId",
    (
      SELECT cs."specialtyId"
      FROM "ClinicSpecialty" cs
      INNER JOIN "SpecialtyCatalog" sc ON sc."id" = cs."specialtyId"
      WHERE cs."clinicId" = a."clinicId"
        AND cs."deletedAt" IS NULL
        AND (
          UPPER(TRIM(sc."code")) = UPPER(TRIM(d."specialty"))
          OR LOWER(TRIM(sc."name")) = LOWER(TRIM(d."specialty"))
          OR LOWER(TRIM(sc."nameAr")) = LOWER(TRIM(d."specialty"))
        )
      LIMIT 1
    ) AS "specialtyId",
    a."entryType",
    a."startsAt",
    a."endsAt",
    a."reason",
    a."notes",
    a."status",
    a."createdAt",
    a."updatedAt",
    a."deletedAt"
FROM "Appointment" a
INNER JOIN "Doctor" d ON d."id" = a."doctorId";

DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";

CREATE INDEX "Appointment_clinicId_idx" ON "Appointment"("clinicId");
CREATE INDEX "Appointment_specialtyId_idx" ON "Appointment"("specialtyId");
CREATE INDEX "Appointment_doctorId_startsAt_idx" ON "Appointment"("doctorId", "startsAt");
CREATE INDEX "Appointment_patientId_startsAt_idx" ON "Appointment"("patientId", "startsAt");
CREATE INDEX "Appointment_clinicId_deletedAt_createdAt_idx" ON "Appointment"("clinicId", "deletedAt", "createdAt");

PRAGMA foreign_keys=ON;
