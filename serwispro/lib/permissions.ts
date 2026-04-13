import type { Session } from "next-auth";

// ---------------------------------------------------------------------------
// Permission key types
// ---------------------------------------------------------------------------

export const MODULES = [
  "orders",
  "clients",
  "vehicles",
  "stock",
  "analytics",
  "templates",
  "protocols",
  "calendar",
  "users",
  "settings",
] as const;

export const ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "export",
  "close",
  "edit_closed",
  "manage",
  "view_all",
  "reset_password",
  "block",
  "manage_admins",
] as const;

export type Module = (typeof MODULES)[number];
export type Action = (typeof ACTIONS)[number];
export type PermissionKey = `${Module}:${Action}`;

// ---------------------------------------------------------------------------
// Legacy key backward-compat mapping
// (used during transition — existing callers still pass old keys)
// ---------------------------------------------------------------------------

export type LegacyPermissionKey =
  | "canCreateOrders"
  | "canEditAllOrders"
  | "canCloseOrders"
  | "canEditClosedOrders"
  | "canDeleteOrders"
  | "canManageClients"
  | "canViewAnalytics"
  | "canManageTemplates"
  | "canManageVehicles"
  | "canGeneratePdf"
  | "canViewAllCalendar";

export const LEGACY_KEY_MAP: Record<LegacyPermissionKey, PermissionKey> = {
  canCreateOrders: "orders:create",
  canEditAllOrders: "orders:edit",
  canCloseOrders: "orders:close",
  canEditClosedOrders: "orders:edit_closed",
  canDeleteOrders: "orders:delete",
  canManageClients: "clients:manage",
  canViewAnalytics: "analytics:view",
  canManageTemplates: "templates:manage",
  canManageVehicles: "vehicles:manage",
  canGeneratePdf: "protocols:export",
  canViewAllCalendar: "calendar:view_all",
};

// ---------------------------------------------------------------------------
// Session user type (what's stored in JWT)
// ---------------------------------------------------------------------------

export type UserSession = Session["user"] & {
  effectivePermissions?: Record<string, boolean>;
  mustChangePassword?: boolean;
  accountStatus?: string;
};

// ---------------------------------------------------------------------------
// Core permission check functions
// ---------------------------------------------------------------------------

/**
 * Primary permission check. Uses effectivePermissions pre-computed at login.
 * Also accepts legacy permission keys for backward compatibility.
 */
export function canDo(
  user: UserSession | null | undefined,
  action: PermissionKey | LegacyPermissionKey
): boolean {
  if (!user) return false;
  if ((user.accountStatus ?? "ACTIVE") !== "ACTIVE") return false;
  if (isSuperAdmin(user)) return true;

  // Resolve legacy key if provided
  const key =
    action in LEGACY_KEY_MAP
      ? LEGACY_KEY_MAP[action as LegacyPermissionKey]
      : (action as PermissionKey);

  // New system: effectivePermissions map in JWT
  if (user.effectivePermissions) {
    return user.effectivePermissions[key] === true;
  }

  // Legacy fallback: flat permissions object (old JWT tokens during transition)
  return (user.permissions as Record<string, boolean>)?.[key] === true;
}

export function isSuperAdmin(user: UserSession | null | undefined): boolean {
  return (user?.roles as string[])?.includes("SUPERADMIN") === true;
}

export function isAdmin(user: UserSession | null | undefined): boolean {
  const roles = user?.roles as string[];
  return (
    roles?.includes("ADMIN") === true ||
    roles?.includes("SUPERADMIN") === true
  );
}

export function hasRole(
  user: UserSession | null | undefined,
  role: string
): boolean {
  return (user?.roles as string[])?.includes(role) === true;
}
