/**
 * Server-side only. Computes effective permissions for a user at login time.
 * Result is stored in the JWT and used for fast client-side permission checks.
 *
 * Resolution order (highest priority first):
 *   1. User DENY override  → false, final
 *   2. User ALLOW override → true, final
 *   3. Any role ALLOW      → true
 *   4. Default             → false
 */

export interface RoleWithPermissions {
  rolePermissions: Array<{
    effect: string;
    permission: {
      module: string;
      action: string;
    };
  }>;
}

export interface PermissionOverride {
  effect: string;
  permission: {
    module: string;
    action: string;
  };
}

export function resolveEffectivePermissions(
  roleAssignments: Array<{ role: RoleWithPermissions }>,
  userOverrides: PermissionOverride[]
): Record<string, boolean> {
  const result: Record<string, boolean> = {};

  // Step 1: collect ALLOW from roles (any role ALLOW = true)
  for (const assignment of roleAssignments) {
    for (const rp of assignment.role.rolePermissions) {
      const key = `${rp.permission.module}:${rp.permission.action}`;
      if (rp.effect === "ALLOW") {
        result[key] = true;
      }
    }
  }

  // Step 2: apply per-user overrides (always win over role-based)
  for (const override of userOverrides) {
    const key = `${override.permission.module}:${override.permission.action}`;
    result[key] = override.effect === "ALLOW";
  }

  return result;
}
