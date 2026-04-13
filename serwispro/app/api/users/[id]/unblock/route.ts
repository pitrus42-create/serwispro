import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { logAudit, getClientIp } from "@/lib/audit";
import { checkCanManageTarget } from "@/lib/user-guards";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const assignments = await prisma.userRoleAssignment.findMany({
    where: { userId: id },
    include: { role: true },
  });
  const targetRoles = assignments.map((a) => a.role.name);

  const manageGuard = checkCanManageTarget(session.user.roles, targetRoles);
  if (manageGuard) return manageGuard;

  await prisma.user.update({
    where: { id },
    data: {
      accountStatus: "ACTIVE",
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "USER_UNBLOCKED",
    entityType: "User",
    entityId: id,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ data: { accountStatus: "ACTIVE" } });
}
