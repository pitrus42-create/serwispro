import { NextResponse } from "next/server";

export function forbidden(
  message: string,
  code?: string
): NextResponse {
  return NextResponse.json(
    { error: message, code: code ?? "FORBIDDEN" },
    { status: 403 }
  );
}

export function isSuperAdminRole(roles: string[]): boolean {
  return roles.includes("SUPERADMIN");
}

export function isAdminRole(roles: string[]): boolean {
  return roles.includes("ADMIN") || roles.includes("SUPERADMIN");
}

/**
 * Returns a 403 response if target user is a SuperAdmin.
 * Use this at the start of any user-modifying endpoint.
 */
export function checkNotSuperAdmin(
  targetRoles: string[]
): NextResponse | null {
  if (isSuperAdminRole(targetRoles)) {
    return forbidden(
      "Nie można modyfikować konta Super Administratora.",
      "PROTECTED_SUPERADMIN_ACCOUNT"
    );
  }
  return null;
}

/**
 * Returns a 403 response if the acting user cannot manage the target's roles.
 * Rules:
 *   - SUPERADMIN can manage everyone
 *   - ADMIN can manage non-admin users only
 *   - Others cannot manage anyone
 */
export function checkCanManageTarget(
  actorRoles: string[],
  targetRoles: string[]
): NextResponse | null {
  if (isSuperAdminRole(actorRoles)) return null; // SuperAdmin can do anything

  // Block managing SuperAdmin
  if (isSuperAdminRole(targetRoles)) {
    return forbidden(
      "Nie można zarządzać kontem Super Administratora.",
      "CANNOT_MANAGE_SUPERADMIN"
    );
  }

  // Regular admin cannot manage other admins
  if (targetRoles.includes("ADMIN") && !isSuperAdminRole(actorRoles)) {
    return forbidden(
      "Administrator nie może zarządzać innymi administratorami.",
      "INSUFFICIENT_ROLE"
    );
  }

  if (!isAdminRole(actorRoles)) {
    return forbidden("Brak wymaganych uprawnień.", "INSUFFICIENT_ROLE");
  }

  return null;
}

/**
 * Validates that an ADMIN cannot assign ADMIN or SUPERADMIN roles.
 * Returns 403 if violation detected.
 */
export function checkRoleAssignmentAllowed(
  actorRoles: string[],
  requestedRoleNames: string[]
): NextResponse | null {
  if (isSuperAdminRole(actorRoles)) return null; // SuperAdmin can assign any role

  const restricted = ["ADMIN", "SUPERADMIN"];
  const hasRestricted = requestedRoleNames.some((r) =>
    restricted.includes(r)
  );

  if (hasRestricted) {
    return forbidden(
      "Administrator nie może nadawać uprawnień administracyjnych.",
      "CANNOT_ASSIGN_ADMIN_ROLE"
    );
  }

  return null;
}
