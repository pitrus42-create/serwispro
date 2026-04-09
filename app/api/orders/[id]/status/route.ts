import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { createNotification } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";
import { addMonths } from "date-fns";

const CYCLE_MONTHS: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
};

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { status } = await req.json();
  if (!status) return NextResponse.json({ error: "status required" }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      assignments: true,
      location: true,
      client: { select: { name: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = isAdmin(session.user);
  const isAssigned = order.assignments.some((a) => a.userId === session.user.id);
  const perms = session.user.permissions as Record<string, boolean>;

  if (!admin && !isAssigned && !perms.canCloseOrders) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const oldStatus = order.status;
  const now = new Date();

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status,
      ...(status === "ZAKONCZONE" ? { completedAt: now } : {}),
    },
  });

  // Update maintenance date if maintenance order completed
  if (status === "ZAKONCZONE" && order.type === "KONSERWACJA" && order.location) {
    const cycle = order.location.maintenanceCycle;
    if (cycle && cycle !== "NONE" && CYCLE_MONTHS[cycle]) {
      await prisma.location.update({
        where: { id: order.location.id },
        data: {
          lastMaintenanceDate: now,
          nextMaintenanceDate: addMonths(now, CYCLE_MONTHS[cycle]),
        },
      });
    }
  }

  // Activity log
  await prisma.orderActivityLog.create({
    data: {
      orderId: id,
      userId: session.user.id,
      action: "status_changed",
      details: JSON.stringify({ from: oldStatus, to: status }),
    },
  });

  // Notify assigned users (except current)
  const notifyIds = order.assignments
    .map((a) => a.userId)
    .filter((uid) => uid !== session.user.id);

  if (notifyIds.length) {
    await createNotification({
      userIds: notifyIds,
      type: "status_changed",
      priority: 5,
      title: `Status zlecenia ${order.orderNumber} zmieniony`,
      message: `${oldStatus} → ${status}`,
      link: `/orders/${id}`,
      relatedEntityType: "order",
      relatedEntityId: id,
    });
  }

  return NextResponse.json({ data: updated });
}
