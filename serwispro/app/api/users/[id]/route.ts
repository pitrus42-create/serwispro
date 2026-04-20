import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin, isSuperAdmin } from "@/lib/permissions";
import { logAudit, getClientIp } from "@/lib/audit";
import { checkCanManageTarget, checkNotSuperAdmin } from "@/lib/user-guards";
import { USER_INCLUDE, sanitizeUser } from "@/app/api/users/route";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

async function getTargetRoles(userId: string): Promise<string[]> {
  const assignments = await prisma.userRoleAssignment.findMany({
    where: { userId },
    include: { role: true },
  });
  return assignments.map((a) => a.role.name);
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (id !== session.user.id && !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: USER_INCLUDE,
  });
  if (!user) {
    return NextResponse.json(
      { error: "Nie znaleziono użytkownika." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: isSuperAdmin(session.user)
      ? (({ passwordHash, ...safe }) => safe)(user as unknown as Record<string, unknown>)
      : sanitizeUser(user as unknown as Record<string, unknown>),
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const isSelf = id === session.user.id;
  const admin = isAdmin(session.user);

  if (!isSelf && !admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { firstName, lastName, phone, position, avatarUrl, email, login, adminNote } =
    body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};

  // Fields any user can update on their own profile
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName !== undefined) data.lastName = lastName;
  if (phone !== undefined) data.phone = phone;
  if (position !== undefined) data.position = position;
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;

  // Fields only admin can update
  if (admin) {
    if (email !== undefined) data.email = email || null;
    if (login !== undefined) data.login = login || null;
    if (adminNote !== undefined) data.adminNote = adminNote;
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    include: USER_INCLUDE,
  });

  await logAudit({
    userId: session.user.id,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: id,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({
    data: sanitizeUser(user as unknown as Record<string, unknown>),
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Nie możesz zarchiwizować własnego konta." },
      { status: 400 }
    );
  }

  const targetRoles = await getTargetRoles(id);

  const superAdminGuard = checkNotSuperAdmin(targetRoles);
  if (superAdminGuard) return superAdminGuard;

  const manageGuard = checkCanManageTarget(session.user.roles, targetRoles);
  if (manageGuard) return manageGuard;

  await prisma.user.update({
    where: { id },
    data: {
      accountStatus: "ARCHIVED",
      isActive: false,
      archivedAt: new Date(),
      archivedBy: session.user.id,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "USER_ARCHIVED",
    entityType: "User",
    entityId: id,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ success: true });
}
