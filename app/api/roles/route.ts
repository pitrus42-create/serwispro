import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin, isSuperAdmin } from "@/lib/permissions";
import { logAudit, getClientIp } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roles = await prisma.role.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          userRoleAssignments: true,
          rolePermissions: true,
        },
      },
    },
  });

  return NextResponse.json({ data: roles });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSuperAdmin(session.user)) {
    return NextResponse.json(
      { error: "Tylko Super Administrator może tworzyć role.", code: "INSUFFICIENT_ROLE" },
      { status: 403 }
    );
  }

  const { name, displayName, description, permissionIds = [] } =
    await req.json();

  if (!name || !displayName) {
    return NextResponse.json(
      { error: "Pola name i displayName są wymagane." },
      { status: 400 }
    );
  }

  const existing = await prisma.role.findFirst({ where: { name } });
  if (existing) {
    return NextResponse.json(
      { error: "Rola o tej nazwie już istnieje." },
      { status: 409 }
    );
  }

  const role = await prisma.role.create({
    data: {
      name,
      displayName,
      description: description ?? null,
      isCustom: true,
      rolePermissions: {
        create: (permissionIds as string[]).map((pid: string) => ({
          permissionId: pid,
          effect: "ALLOW",
        })),
      },
    },
    include: {
      rolePermissions: {
        include: { permission: true },
      },
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "ROLE_CREATED",
    entityType: "Role",
    entityId: role.id,
    details: JSON.stringify({ name }),
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ data: role }, { status: 201 });
}
