import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { authConfig } from "../auth.config";
import { decode } from "@auth/core/jwt";
import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { resolveEffectivePermissions } from "./permissions-resolver";

const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

export const { handlers, auth, signIn, signOut } = NextAuth({
  logger: {
    error: (e) => console.error("[NextAuth Error]", e),
    warn: (code) => console.warn("[NextAuth Warn]", code),
  },
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Login lub e-mail", type: "text" },
        password: { label: "Hasło", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const identifier = credentials.email as string;
        const password = credentials.password as string;

        // Support login via email OR login username
        const user = await prisma.user.findFirst({
          where: {
            OR: [{ email: identifier }, { login: identifier }],
          },
          include: {
            roleAssignments: {
              include: {
                role: {
                  include: {
                    rolePermissions: { include: { permission: true } },
                  },
                },
              },
            },
            permissionOverrides: { include: { permission: true } },
            roles: true,
            permissions: true,
          },
        });

        if (!user) return null;

        // Block login for non-active accounts
        if (user.accountStatus !== "ACTIVE") return null;

        // Check temporary lockout
        if (user.lockedUntil && user.lockedUntil > new Date()) return null;

        const valid = await bcrypt.compare(password, user.passwordHash ?? "");

        if (!valid) {
          const newAttempts = user.failedLoginAttempts + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: newAttempts,
              lockedUntil:
                newAttempts >= LOCKOUT_ATTEMPTS
                  ? new Date(
                      Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000
                    )
                  : null,
            },
          });
          return null;
        }

        // Successful login — reset lockout counters
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
        });

        // Compute effective permissions (new RBAC system)
        const effectivePermissions = resolveEffectivePermissions(
          user.roleAssignments,
          user.permissionOverrides
        );

        // Legacy permissions for backward compat during JWT transition
        const legacyPermissions = (
          user.permissions as Record<string, unknown>
        ) ?? {};

        const roleNames = user.roleAssignments.map((ra) => ra.role.name);

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: roleNames,
          effectivePermissions,
          permissions: legacyPermissions as Record<string, boolean>,
          mustChangePassword: user.mustChangePassword,
          accountStatus: user.accountStatus,
        };
      },
    }),
    Credentials({
      id: "google-firebase",
      name: "Google",
      credentials: { idToken: { type: "text" } },
      async authorize(credentials) {
        if (!credentials?.idToken) return null;

        const { adminAuth } = await import("./firebase-admin");
        const decoded = await adminAuth.verifyIdToken(
          credentials.idToken as string
        );

        if (!decoded.email) return null;

        let user = await prisma.user.findFirst({
          where: {
            OR: [{ googleId: decoded.uid }, { email: decoded.email }],
          },
          include: {
            roleAssignments: {
              include: {
                role: {
                  include: {
                    rolePermissions: { include: { permission: true } },
                  },
                },
              },
            },
            permissionOverrides: { include: { permission: true } },
            roles: true,
            permissions: true,
          },
        });

        if (!user) {
          const serwisantRole = await prisma.role.findFirst({
            where: { name: "SERWISANT" },
          });

          const nameParts = (decoded.name ?? "").split(" ");
          const createdUser = await prisma.user.create({
            data: {
              googleId: decoded.uid,
              email: decoded.email,
              firstName: nameParts[0] ?? "Google",
              lastName: nameParts.slice(1).join(" ") || "User",
              accountStatus: "ACTIVE",
              isActive: true,
              mustChangePassword: false,
              ...(serwisantRole
                ? { roleAssignments: { create: [{ roleId: serwisantRole.id }] } }
                : { roles: { create: [{ role: "SERWISANT" }] } }),
              permissions: { create: {} },
            },
            include: {
              roleAssignments: {
                include: {
                  role: {
                    include: {
                      rolePermissions: { include: { permission: true } },
                    },
                  },
                },
              },
              permissionOverrides: { include: { permission: true } },
              roles: true,
              permissions: true,
            },
          });
          user = createdUser;
        } else if (!user.googleId) {
          await prisma.user.update({
            where: { id: user.id },
            data: { googleId: decoded.uid },
          });
        }

        if (user.accountStatus !== "ACTIVE") return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        const effectivePermissions = resolveEffectivePermissions(
          user.roleAssignments,
          user.permissionOverrides
        );

        const legacyPermissions = (
          user.permissions as Record<string, unknown>
        ) ?? {};

        const roleNames = user.roleAssignments.map((ra) => ra.role.name);

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: roleNames,
          effectivePermissions,
          permissions: legacyPermissions as Record<string, boolean>,
          mustChangePassword: user.mustChangePassword,
          accountStatus: user.accountStatus,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.firstName = (user as { firstName: string }).firstName;
        token.lastName = (user as { lastName: string }).lastName;
        token.roles = (user as { roles: string[] }).roles;
        token.effectivePermissions = (
          user as { effectivePermissions: Record<string, boolean> }
        ).effectivePermissions;
        token.permissions = (
          user as { permissions: Record<string, boolean> }
        ).permissions;
        token.mustChangePassword = (
          user as { mustChangePassword: boolean }
        ).mustChangePassword;
        token.accountStatus = (
          user as { accountStatus: string }
        ).accountStatus;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
        session.user.roles = token.roles as string[];
        session.user.effectivePermissions =
          (token.effectivePermissions as Record<string, boolean>) ?? {};
        session.user.permissions =
          (token.permissions as Record<string, boolean>) ?? {};
        session.user.mustChangePassword =
          (token.mustChangePassword as boolean) ?? false;
        session.user.accountStatus =
          (token.accountStatus as string) ?? "ACTIVE";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
});

// Odczytuje sesję bezpośrednio z JWT cookie na requescie, bez wywoływania headers()
// Wymagane w Next.js 16 — next-auth beta.30 woła headers() poza async storage (E251)
export async function getAuth(req: NextRequest): Promise<Session | null> {
  // In Cloud Run / Firebase App Hosting, req.url is http:// internally even when the user
  // connects via https://. Check both cookie names and use whichever is present.
  const secureName = "__Secure-authjs.session-token";
  const plainName = "authjs.session-token";
  const secureToken = req.cookies.get(secureName)?.value;
  const plainToken = req.cookies.get(plainName)?.value;
  const cookieName = secureToken ? secureName : plainName;
  const token = secureToken ?? plainToken;
  if (!token) return null;
  try {
    const decoded = await decode({
      token,
      secret: process.env.NEXTAUTH_SECRET!,
      salt: cookieName,
    });
    if (!decoded) return null;
    return {
      user: {
        id: decoded.id as string,
        email: decoded.email as string,
        name: decoded.name as string,
        firstName: decoded.firstName as string,
        lastName: decoded.lastName as string,
        roles: (decoded.roles as string[]) ?? [],
        effectivePermissions:
          (decoded.effectivePermissions as Record<string, boolean>) ?? {},
        permissions: (decoded.permissions as Record<string, boolean>) ?? {},
        mustChangePassword: (decoded.mustChangePassword as boolean) ?? false,
        accountStatus: (decoded.accountStatus as string) ?? "ACTIVE",
      },
      expires: new Date(
        ((decoded.exp as number) ?? 0) * 1000
      ).toISOString(),
    } as Session;
  } catch {
    return null;
  }
}
