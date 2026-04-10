import type { NextAuthConfig } from "next-auth";

// Minimal config for edge middleware — no database calls
export const authConfig: NextAuthConfig = {
  providers: [],
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      const isPublicRoute =
        pathname === "/login" ||
        pathname.startsWith("/quote/") ||
        pathname.startsWith("/api/public/") ||
        pathname.startsWith("/api/auth/") ||
        pathname.startsWith("/_next/") ||
        pathname.startsWith("/favicon") ||
        pathname.startsWith("/icon-") ||
        pathname.startsWith("/manifest");

      if (isPublicRoute) return true;
      return isLoggedIn;
    },
  },
};
