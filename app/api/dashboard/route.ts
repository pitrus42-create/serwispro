import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/permissions";
import { startOfDay, endOfDay } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = isAdmin(session.user);
  const today = new Date();

  const userFilter = admin
    ? {}
    : { assignments: { some: { userId: session.user.id } } };

  const [
    criticalAlerts,
    openAlerts,
    overdueOrders,
    todayOrders,
    highPriorityOrders,
    pendingMaintenance,
    recentActivity,
  ] = await Promise.all([
    // Critical open failures
    prisma.order.count({
      where: {
        ...userFilter,
        isCritical: true,
        status: { in: ["OCZEKUJACE", "PRZYJETE", "W_TOKU"] },
      },
    }),
    // All open failures
    prisma.order.count({
      where: {
        ...userFilter,
        type: "AWARIA",
        status: { in: ["OCZEKUJACE", "PRZYJETE", "W_TOKU"] },
      },
    }),
    // Overdue
    prisma.order.count({
      where: {
        ...userFilter,
        scheduledAt: { lt: startOfDay(today) },
        status: { in: ["OCZEKUJACE", "PRZYJETE", "W_TOKU"] },
      },
    }),
    // Today's orders
    prisma.order.findMany({
      where: {
        ...userFilter,
        scheduledAt: {
          gte: startOfDay(today),
          lte: endOfDay(today),
        },
        status: { not: "ZAKONCZONE" },
      },
      include: {
        client: { select: { name: true } },
        assignments: {
          where: { isLead: true },
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: 10,
    }),
    // High priority open
    prisma.order.count({
      where: {
        ...userFilter,
        priority: { in: ["WYSOKI", "KRYTYCZNY"] },
        status: { in: ["OCZEKUJACE", "PRZYJETE", "W_TOKU"] },
      },
    }),
    // Locations with upcoming maintenance (next 30 days)
    admin
      ? prisma.location.count({
          where: {
            maintenanceCycle: { not: "NONE" },
            nextMaintenanceDate: {
              lte: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000),
            },
            isActive: true,
          },
        })
      : Promise.resolve(0),
    // Recent activity
    prisma.orderActivityLog.findMany({
      where: admin
        ? {}
        : { order: { assignments: { some: { userId: session.user.id } } } },
      include: {
        user: { select: { firstName: true, lastName: true } },
        order: { select: { orderNumber: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    criticalAlerts,
    openAlerts,
    overdueOrders,
    todayOrders,
    highPriorityOrders,
    pendingMaintenance,
    recentActivity,
  });
}
