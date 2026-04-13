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
        pathname === "/change-password" ||
        pathname.startsWith("/quote/") ||
        pathname.startsWith("/api/public/") ||
        pathname.startsWith("/api/auth/") ||
        pathname.startsWith("/_next/") ||
        pathname.startsWith("/favicon") ||
        pathname.startsWith("/icon-") ||
        pathname.startsWith("/manifest");

      if (isPublicRoute) return true;
      if (!isLoggedIn) return false;

      // Force password change — redirect to /change-password
      // mustChangePassword is stored in JWT so no DB call needed here
      const mustChangePassword =
        (auth?.user as { mustChangePassword?: boolean })?.mustChangePassword ??
        false;

      if (mustChangePassword && pathname !== "/change-password") {
        return Response.redirect(
          new URL("/change-password", request.url)
        );
      }

      return true;
    },
  },
};
