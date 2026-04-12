import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { logAudit, getClientIp } from "@/lib/audit";
import { checkNotSuperAdmin, checkCanManageTarget } from "@/lib/user-guards";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

async function getTargetRoles(userId: string): Promise<string[]> {
  const assignments = await prisma.userRoleAssignment.findMany({
    where: { userId },
    include: { role: true },
  });
  return assignments.map((a) => a.role.name);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Nie możesz usunąć własnego konta." },
      { status: 400 }
    );
  }

  const targetRoles = await getTargetRoles(id);

  const superAdminGuard = checkNotSuperAdmin(targetRoles);
  if (superAdminGuard) return superAdminGuard;

  const manageGuard = checkCanManageTarget(session.user.roles, targetRoles);
  if (manageGuard) return manageGuard;

  // Block deletion if user authored any orders — those have non-nullable createdById
  const orderCount = await prisma.order.count({ where: { createdById: id } });
  if (orderCount > 0) {
    return NextResponse.json(
      {
        error: `Nie można usunąć — użytkownik jest autorem ${orderCount} zleceń. Zarchiwizuj go zamiast usuwać.`,
      },
      { status: 400 }
    );
  }

  // Nullify optional FK references, then delete (assignments cascade automatically)
  await prisma.$transaction([
    prisma.orderActivityLog.updateMany({ where: { userId: id }, data: { userId: null } }),
    prisma.orderAttachment.updateMany({ where: { uploadedBy: id }, data: { uploadedBy: null } }),
    prisma.orderChecklistItem.updateMany({ where: { checkedBy: id }, data: { checkedBy: null } }),
    prisma.orderMaterial.updateMany({ where: { addedBy: id }, data: { addedBy: null } }),
    prisma.protocolPhoto.updateMany({ where: { uploadedBy: id }, data: { uploadedBy: null } }),
    prisma.vehicleServiceEntry.updateMany({ where: { addedBy: id }, data: { addedBy: null } }),
    prisma.user.delete({ where: { id } }),
  ]);

  await logAudit({
    userId: session.user.id,
    action: "USER_PERMANENTLY_DELETED",
    entityType: "User",
    entityId: id,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ success: true });
}
