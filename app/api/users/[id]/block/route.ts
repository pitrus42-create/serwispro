import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { logAudit, getClientIp } from "@/lib/audit";
import { checkCanManageTarget, checkNotSuperAdmin } from "@/lib/user-guards";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Nie możesz zablokować własnego konta." },
      { status: 400 }
    );
  }

  const assignments = await prisma.userRoleAssignment.findMany({
    where: { userId: id },
    include: { role: true },
  });
  const targetRoles = assignments.map((a) => a.role.name);

  const superAdminGuard = checkNotSuperAdmin(targetRoles);
  if (superAdminGuard) return superAdminGuard;

  const manageGuard = checkCanManageTarget(session.user.roles, targetRoles);
  if (manageGuard) return manageGuard;

  await prisma.user.update({
    where: { id },
    data: { accountStatus: "BLOCKED", isActive: false },
  });

  await logAudit({
    userId: session.user.id,
    action: "USER_BLOCKED",
    entityType: "User",
    entityId: id,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ data: { accountStatus: "BLOCKED" } });
}
