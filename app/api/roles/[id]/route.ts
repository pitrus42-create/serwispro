import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin, isSuperAdmin } from "@/lib/permissions";
import { logAudit, getClientIp } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      rolePermissions: {
        include: { permission: true },
      },
      _count: { select: { userRoleAssignments: true } },
    },
  });

  if (!role) {
    return NextResponse.json({ error: "Nie znaleziono roli." }, { status: 404 });
  }

  return NextResponse.json({ data: role });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSuperAdmin(session.user)) {
    return NextResponse.json(
      { error: "Tylko Super Administrator może edytować role.", code: "INSUFFICIENT_ROLE" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) {
    return NextResponse.json({ error: "Nie znaleziono roli." }, { status: 404 });
  }

  const { displayName, description, permissionIds } = await req.json();

  const updated = await prisma.role.update({
    where: { id },
    data: {
      ...(displayName !== undefined && { displayName }),
      ...(description !== undefined && { description }),
      ...(permissionIds !== undefined && {
        rolePermissions: {
          deleteMany: {},
          create: (permissionIds as string[]).map((pid: string) => ({
            permissionId: pid,
            effect: "ALLOW",
          })),
        },
      }),
    },
    include: {
      rolePermissions: { include: { permission: true } },
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "ROLE_UPDATED",
    entityType: "Role",
    entityId: id,
    details: JSON.stringify({ displayName }),
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSuperAdmin(session.user)) {
    return NextResponse.json(
      { error: "Tylko Super Administrator może usuwać role.", code: "INSUFFICIENT_ROLE" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const role = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { userRoleAssignments: true } } },
  });

  if (!role) {
    return NextResponse.json({ error: "Nie znaleziono roli." }, { status: 404 });
  }

  if (role.isSystem) {
    return NextResponse.json(
      { error: "Nie można usunąć roli systemowej.", code: "SYSTEM_ROLE" },
      { status: 422 }
    );
  }

  if (role._count.userRoleAssignments > 0) {
    return NextResponse.json(
      {
        error: `Rola jest przypisana do ${role._count.userRoleAssignments} użytkowników. Usuń przypisania przed usunięciem roli.`,
        code: "ROLE_IN_USE",
        count: role._count.userRoleAssignments,
      },
      { status: 409 }
    );
  }

  await prisma.role.delete({ where: { id } });

  await logAudit({
    userId: session.user.id,
    action: "ROLE_DELETED",
    entityType: "Role",
    entityId: id,
    details: JSON.stringify({ name: role.name }),
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ success: true });
}
