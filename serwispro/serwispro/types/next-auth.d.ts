import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string | null;
      name: string;
      firstName: string;
      lastName: string;
      roles: string[];
      // New: pre-computed effective permissions map (RBAC + overrides)
      effectivePermissions: Record<string, boolean>;
      // Legacy: kept for backward-compat during JWT token transition
      permissions: Record<string, boolean>;
      mustChangePassword: boolean;
      accountStatus: string;
      image?: string | null;
    };
  }

  interface User {
    id: string;
    email: string | null;
    name: string;
    firstName: string;
    lastName: string;
    roles: string[];
    effectivePermissions: Record<string, boolean>;
    permissions: Record<string, boolean>;
    mustChangePassword: boolean;
    accountStatus: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    firstName: string;
    lastName: string;
    roles: string[];
    effectivePermissions: Record<string, boolean>;
    permissions: Record<string, boolean>;
    mustChangePassword: boolean;
    accountStatus: string;
  }
}
