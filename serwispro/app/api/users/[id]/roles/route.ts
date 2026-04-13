import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { logAudit, getClientIp } from "@/lib/audit";
import { checkRoleAssignmentAllowed, checkNotSuperAdmin } from "@/lib/user-guards";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { roleIds } = await req.json();

  if (!Array.isArray(roleIds)) {
    return NextResponse.json(
      { error: "roleIds musi być tablicą." },
      { status: 400 }
    );
  }

  // Fetch target current roles for SuperAdmin protection
  const currentAssignments = await prisma.userRoleAssignment.findMany({
    where: { userId: id },
    include: { role: true },
  });
  const currentRoles = currentAssignments.map((a) => a.role.name);

  const superAdminGuard = checkNotSuperAdmin(currentRoles);
  if (superAdminGuard) return superAdminGuard;

  // Validate requested roles
  const requestedRoles = await prisma.role.findMany({
    where: { id: { in: roleIds } },
    select: { name: true },
  });
  const requestedRoleNames = requestedRoles.map((r) => r.name);

  const guard = checkRoleAssignmentAllowed(session.user.roles, requestedRoleNames);
  if (guard) return guard;

  // Atomic replacement of all role assignments
  await prisma.$transaction([
    prisma.userRoleAssignment.deleteMany({ where: { userId: id } }),
    prisma.userRoleAssignment.createMany({
      data: (roleIds as string[]).map((rid) => ({
        userId: id,
        roleId: rid,
        assignedBy: session.user.id,
      })),
    }),
  ]);

  await logAudit({
    userId: session.user.id,
    action: "ROLES_ASSIGNED",
    entityType: "User",
    entityId: id,
    details: JSON.stringify({ roleIds }),
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ data: { roles: requestedRoleNames } });
}
