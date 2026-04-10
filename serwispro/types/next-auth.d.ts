import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      firstName: string;
      lastName: string;
      roles: string[];
      permissions: Record<string, boolean>;
      image?: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    firstName: string;
    lastName: string;
    roles: string[];
    permissions: Record<string, boolean>;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    firstName: string;
    lastName: string;
    roles: string[];
    permissions: Record<string, boolean>;
  }
}
