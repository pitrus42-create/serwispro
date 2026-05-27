import { auth, getAuth } from "@/lib/auth";
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
  const session = await getAuth(req);
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

  try {
    const users = await prisma.user.findMany({
      where,
      orderBy: { firstName: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    });
    const total = await prisma.user.count({ where });

    if (users.length === 0) {
      return NextResponse.json({ data: [], total });
    }

    const userIds = users.map((u) => u.id);

    const roleAssignments = await prisma.userRoleAssignment.findMany({
      where: { userId: { in: userIds } },
    });
    const roleIds = [...new Set(roleAssignments.map((r) => r.roleId))];
    const roles = roleIds.length > 0
      ? await prisma.role.findMany({ where: { id: { in: roleIds } } })
      : [];

    const permissionOverrides = await prisma.userPermissionOverride.findMany({
      where: { userId: { in: userIds } },
    });
    const permissionIds = [...new Set(permissionOverrides.map((p) => p.permissionId))];
    const permissions = permissionIds.length > 0
      ? await prisma.permission.findMany({ where: { id: { in: permissionIds } } })
      : [];

    const userSettingsList = await prisma.userSettings.findMany({
      where: { userId: { in: userIds } },
    });

    const enriched = users.map((u) => ({
      ...u,
      roleAssignments: roleAssignments
        .filter((r) => r.userId === u.id)
        .map((r) => ({ ...r, role: roles.find((role) => role.id === r.roleId) ?? null })),
      permissionOverrides: permissionOverrides
        .filter((p) => p.userId === u.id)
        .map((p) => ({ ...p, permission: permissions.find((perm) => perm.id === p.permissionId) ?? null })),
      userSettings: userSettingsList.find((s) => s.userId === u.id) ?? null,
    }));

    const safe = enriched.map((u) =>
      sanitizeUser(u as unknown as Record<string, unknown>)
    );
    return NextResponse.json({ data: safe, total });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("GET /api/users error:", {
      name: e instanceof Error ? e.name : "Unknown",
      message: msg,
      stack: e instanceof Error ? e.stack : undefined,
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAuth(req);
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
