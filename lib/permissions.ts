import type { Session } from "next-auth";

type UserSession = Session["user"];

export type PermissionKey =
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

export function canDo(
  user: UserSession | null | undefined,
  action: PermissionKey
): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return (user.permissions as Record<string, boolean>)?.[action] === true;
}

export function isAdmin(user: UserSession | null | undefined): boolean {
  return (user?.roles as string[])?.includes("ADMIN") === true;
}

export function hasRole(
  user: UserSession | null | undefined,
  role: string
): boolean {
  return (user?.roles as string[])?.includes(role) === true;
}
