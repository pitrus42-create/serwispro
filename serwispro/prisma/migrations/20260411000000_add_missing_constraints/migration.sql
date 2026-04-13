-- AddMissingConstraints: sync schema.prisma unique directives with DB indexes
-- These indexes were added manually to the local DB but were missing from the schema.
-- Using IF NOT EXISTS so this migration is safe to run on DBs that already have them.

CREATE UNIQUE INDEX IF NOT EXISTS "Role_name_key" ON "Role"("name");

CREATE UNIQUE INDEX IF NOT EXISTS "UserRoleAssignment_userId_roleId_key" ON "UserRoleAssignment"("userId", "roleId");
CREATE INDEX IF NOT EXISTS "UserRoleAssignment_userId_idx" ON "UserRoleAssignment"("userId");
CREATE INDEX IF NOT EXISTS "UserRoleAssignment_roleId_idx" ON "UserRoleAssignment"("roleId");

CREATE UNIQUE INDEX IF NOT EXISTS "Permission_module_action_key" ON "Permission"("module", "action");
CREATE INDEX IF NOT EXISTS "Permission_module_idx" ON "Permission"("module");

CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");
CREATE INDEX IF NOT EXISTS "RolePermission_roleId_idx" ON "RolePermission"("roleId");

CREATE UNIQUE INDEX IF NOT EXISTS "UserPermissionOverride_userId_permissionId_key" ON "UserPermissionOverride"("userId", "permissionId");
CREATE INDEX IF NOT EXISTS "UserPermissionOverride_userId_idx" ON "UserPermissionOverride"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordReset_token_key" ON "PasswordReset"("token");
CREATE INDEX IF NOT EXISTS "PasswordReset_userId_idx" ON "PasswordReset"("userId");
CREATE INDEX IF NOT EXISTS "PasswordReset_token_idx" ON "PasswordReset"("token");
