INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT
  lower(hex(randomblob(16))) AS "id",
  r."id" AS "roleId",
  p."id" AS "permissionId",
  CURRENT_TIMESTAMP AS "createdAt"
FROM "Role" r
INNER JOIN "Permission" p ON p."key" = 'specialty_assessments.manage'
WHERE r."name" = 'ClinicAdmin'
  AND r."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "RolePermission" rp
    WHERE rp."roleId" = r."id"
      AND rp."permissionId" = p."id"
  );
