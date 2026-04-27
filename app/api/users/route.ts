import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin, isSuperAdmin } from "@/lib/permissions";
import { logAudit, getClientIp } from "@/lib/audit";
import { validatePasswordStrength } from "@/lib/password";
import { checkRoleAssignmentAllowed } from "@/lib/user-guards";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export const USER_INCLUDE = {
  roleAssignments: {
    include: { role: true },
  },
  permissionOverrides: {
    include: { permission: true },
  },
  userSettings: true,
} as const;

export function sanitizeUser(user: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, tempPasswordPlain, ...safe } = user;
  void tempPasswordPlain; // stripped by default — use sanitizeUserSuperAdmin for super admin
  return safe;
}

export function sanitizeUserSuperAdmin(user: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = user;
  return safe;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const roleId = searchParams.get("roleId");
  const q = searchParams.get("q");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));

  const adminUser = isAdmin(session.user);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  // Non-admins only see active users
  if (!adminUser) {
    where.accountStatus = "ACTIVE";
  } else if (status) {
    where.accountStatus = status;
  }

  if (q) {
    where.OR = [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { email: { contains: q } },
      { login: { contains: q } },
    ];
  }

  if (roleId) {
    where.roleAssignments = { some: { roleId } };
  }

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      include: USER_INCLUDE,
      orderBy: { firstName: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  const safe = users.map((u) =>
    sanitizeUser(u as unknown as Record<string, unknown>)
  );
  return NextResponse.json({ data: safe, total });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    firstName,
    lastName,
    email,
    login,
    phone,
    position,
    adminNote,
    password,
    roleIds = [],
    permissionOverrides = [],
  } = body;

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "Imię i nazwisko są wymagane." },
      { status: 400 }
    );
  }

  if (!email && !login) {
    return NextResponse.json(
      { error: "Wymagany jest e-mail lub login." },
      { status: 400 }
    );
  }

  if (!password) {
    return NextResponse.json(
      { error: "Hasło jest wymagane." },
      { status: 400 }
    );
  }

  const { valid, errors } = validatePasswordStrength(password);
  if (!valid) {
    return NextResponse.json(
      {
        error: "Hasło nie spełnia wymagań.",
        fields: { password: errors.join(", ") },
      },
      { status: 400 }
    );
  }

  // Validate role assignment permissions
  if (roleIds.length > 0) {
    const roles = await prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { name: true },
    });
    const roleNames = roles.map((r) => r.name);
    const guard = checkRoleAssignmentAllowed(session.user.roles, roleNames);
    if (guard) return guard;
  }

  // Check uniqueness
  if (email) {
    const existing = await prisma.user.findFirst({ where: { email } });
    if (existing) {
      return NextResponse.json(
        {
          error: "Użytkownik z tym e-mailem już istnieje.",
          code: "EMAIL_TAKEN",
        },
        { status: 409 }
      );
    }
  }
  if (login) {
    const existing = await prisma.user.findFirst({ where: { login } });
    if (existing) {
      return NextResponse.json(
        {
          error: "Użytkownik z tym loginem już istnieje.",
          code: "LOGIN_TAKEN",
        },
        { status: 409 }
      );
    }
  }

  const hash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email: email || null,
      login: login || null,
      phone: phone || null,
      position: position || null,
      adminNote: adminNote || null,
      passwordHash: hash,
      mustChangePassword: true,
      accountStatus: "ACTIVE",
      isActive: true,
      createdById: session.user.id,
      roleAssignments: {
        create: (roleIds as string[]).map((rid: string) => ({
          roleId: rid,
          assignedBy: session.user.id,
        })),
      },
      permissionOverrides: {
        create: permissionOverrides.map(
          (o: { permissionId: string; effect: string; reason?: string }) => ({
            permissionId: o.permissionId,
            effect: o.effect,
            reason: o.reason ?? null,
            grantedBy: session.user.id,
          })
        ),
      },
      userSettings: { create: {} },
    },
    include: USER_INCLUDE,
  });

  await logAudit({
    userId: session.user.id,
    action: "USER_CREATED",
    entityType: "User",
    entityId: user.id,
    details: JSON.stringify({ firstName, lastName, email }),
    ipAddress: getClientIp(req),
  });

  void isSuperAdmin; // used in roles route, suppress lint

  return NextResponse.json(
    { data: sanitizeUser(user as unknown as Record<string, unknown>) },
    { status: 201 }
  );
}
