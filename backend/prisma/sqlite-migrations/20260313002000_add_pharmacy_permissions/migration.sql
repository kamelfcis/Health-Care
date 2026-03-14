INSERT INTO "Permission" ("id", "key", "label", "category", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), 'pharmacy.view', 'View pharmacy', 'pharmacy', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Permission" WHERE "key" = 'pharmacy.view');

INSERT INTO "Permission" ("id", "key", "label", "category", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), 'pharmacy.create', 'Create medicines', 'pharmacy', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Permission" WHERE "key" = 'pharmacy.create');

INSERT INTO "Permission" ("id", "key", "label", "category", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), 'pharmacy.edit', 'Edit medicines', 'pharmacy', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Permission" WHERE "key" = 'pharmacy.edit');

INSERT INTO "Permission" ("id", "key", "label", "category", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), 'pharmacy.delete', 'Delete medicines', 'pharmacy', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Permission" WHERE "key" = 'pharmacy.delete');

INSERT INTO "Permission" ("id", "key", "label", "category", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), 'pharmacy.import', 'Import medicines', 'pharmacy', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Permission" WHERE "key" = 'pharmacy.import');

INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT lower(hex(randomblob(16))), r."id", p."id", CURRENT_TIMESTAMP
FROM "Role" r
INNER JOIN "Permission" p ON p."key" IN ('pharmacy.view', 'pharmacy.create', 'pharmacy.edit', 'pharmacy.delete', 'pharmacy.import')
WHERE r."name" = 'ClinicAdmin'
  AND r."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "RolePermission" rp
    WHERE rp."roleId" = r."id"
      AND rp."permissionId" = p."id"
  );

INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT lower(hex(randomblob(16))), r."id", p."id", CURRENT_TIMESTAMP
FROM "Role" r
INNER JOIN "Permission" p ON p."key" = 'pharmacy.view'
WHERE r."name" IN ('Doctor', 'Nurse', 'Receptionist')
  AND r."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "RolePermission" rp
    WHERE rp."roleId" = r."id"
      AND rp."permissionId" = p."id"
  );
