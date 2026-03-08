INSERT INTO "Permission" ("id", "key", "label", "category", "createdAt", "updatedAt")
SELECT
  lower(hex(randomblob(16))),
  'specialty_assessments.manage',
  'Manage specialty assessments',
  'medical_records',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "Permission" WHERE "key" = 'specialty_assessments.manage'
);

INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT
  lower(hex(randomblob(16))),
  "Role"."id",
  "Permission"."id",
  CURRENT_TIMESTAMP
FROM "Role"
JOIN "Permission" ON "Permission"."key" = 'specialty_assessments.manage'
WHERE "Role"."name" = 'Doctor'
  AND "Role"."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "RolePermission"
    WHERE "RolePermission"."roleId" = "Role"."id"
      AND "RolePermission"."permissionId" = "Permission"."id"
  );
