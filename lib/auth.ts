import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { authConfig } from "../auth.config";

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
        email: { label: "Email", type: "email" },
        password: { label: "Hasło", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            roles: true,
            permissions: true,
          },
        });

        if (!user || !user.isActive || !user.passwordHash) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles.map((r) => r.role),
          permissions: user.permissions ?? {},
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
        const decoded = await adminAuth.verifyIdToken(credentials.idToken as string);

        if (!decoded.email) return null;

        let user = await prisma.user.findFirst({
          where: { OR: [{ googleId: decoded.uid }, { email: decoded.email }] },
          include: { roles: true, permissions: true },
        });

        if (!user) {
          const nameParts = (decoded.name ?? "").split(" ");
          user = await prisma.user.create({
            data: {
              googleId: decoded.uid,
              email: decoded.email,
              firstName: nameParts[0] ?? "Google",
              lastName: nameParts.slice(1).join(" ") || "User",
              isActive: true,
              roles: { create: [{ role: "SERWISANT" }] },
              permissions: { create: {} },
            },
            include: { roles: true, permissions: true },
          });
        } else if (!user.googleId) {
          await prisma.user.update({
            where: { id: user.id },
            data: { googleId: decoded.uid },
          });
        }

        if (!user.isActive) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles.map((r) => r.role),
          permissions: user.permissions ?? {},
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
        token.permissions = (user as { permissions: Record<string, boolean> }).permissions;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
        session.user.roles = token.roles as string[];
        session.user.permissions = token.permissions as Record<string, boolean>;
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
    maxAge: 8 * 60 * 60, // 8h
  },
  secret: process.env.NEXTAUTH_SECRET,
});
