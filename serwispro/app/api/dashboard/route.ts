import { auth, getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/permissions";
import { startOfDay, endOfDay } from "date-fns";

export async function GET(req: NextRequest) {
  try {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = isAdmin(session.user);
  const today = new Date();

  const userFilter = admin
    ? {}
    : { assignments: { some: { userId: session.user.id } } };

  const criticalAlerts = await prisma.order.count({
    where: { ...userFilter, isCritical: true, status: { in: ["OCZEKUJACE", "PRZYJETE", "W_TOKU"] } },
  });
  const openAlerts = await prisma.order.count({
    where: { ...userFilter, type: "AWARIA", status: { in: ["OCZEKUJACE", "PRZYJETE", "W_TOKU"] } },
  });
  const overdueOrders = await prisma.order.count({
    where: { ...userFilter, scheduledAt: { lt: startOfDay(today) }, status: { in: ["OCZEKUJACE", "PRZYJETE", "W_TOKU"] } },
  });
  const todayOrders = await prisma.order.findMany({
    where: {
      ...userFilter,
      scheduledAt: { gte: startOfDay(today), lte: endOfDay(today) },
      status: { not: "ZAKONCZONE" },
    },
    include: {
      client: { select: { name: true } },
      location: { select: { address: true, city: true } },
      assignments: {
        where: { isLead: true },
        include: { user: { select: { firstName: true, lastName: true } } },
      },
    },
    orderBy: { scheduledAt: "asc" },
    take: 10,
  });
  const waitingOrders = await prisma.order.count({
    where: { status: "OCZEKUJACE", scheduledAt: null },
  });
  const unsettledOrders = admin
    ? await prisma.order.count({ where: { status: "ZAKONCZONE", isSettled: false } })
    : 0;
  const overdueOrdersList = await prisma.order.findMany({
    where: {
      ...userFilter,
      scheduledAt: { lt: startOfDay(today) },
      status: { in: ["OCZEKUJACE", "PRZYJETE", "W_TOKU"] },
    },
    include: {
      client: { select: { name: true } },
      location: { select: { address: true, city: true } },
      assignments: {
        where: { isLead: true },
        include: { user: { select: { firstName: true, lastName: true } } },
      },
    },
    orderBy: { scheduledAt: "asc" },
    take: 5,
  });
  const todaySimpleTasks = await prisma.simpleTask.findMany({
    where: {
      isCompleted: false,
      date: { gte: startOfDay(today), lte: endOfDay(today) },
      OR: [
        { assignedUserId: session.user.id },
        { createdById: session.user.id },
      ],
    },
    include: {
      assignedUser: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ dayOrder: "asc" }, { createdAt: "asc" }],
  });
  const pendingMaintenance = admin
    ? await prisma.location.count({
        where: {
          maintenanceCycle: { not: "NONE" },
          nextMaintenanceDate: { lte: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) },
          isActive: true,
        },
      })
    : 0;
  const recentActivity = await prisma.orderActivityLog.findMany({
    where: admin ? {} : { order: { assignments: { some: { userId: session.user.id } } } },
    include: {
      user: { select: { firstName: true, lastName: true } },
      order: { select: { orderNumber: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const INQUIRY_ACTIVE_STATUSES = [
    "NOWE", "W_ANALIZIE", "BRAKUJE_INFO", "GOTOWE_DO_WYCENY",
    "WYCENA_PRZYGOTOWANA", "WYCENA_WYSLANA", "OCZEKUJE_NA_DECYZJE",
    "ZAAKCEPTOWANE", "ZAPLANOWANO_MONTAZ",
  ];
  const inquiryBase = { deletedAt: null as Date | null, archivedAt: null as Date | null };
  const [inquiryNew, inquiryActive, inquiryToQuote, inquiryWaiting] = await Promise.all([
    prisma.inquiry.count({ where: { ...inquiryBase, status: "NOWE" } }),
    prisma.inquiry.count({ where: { ...inquiryBase, status: { in: INQUIRY_ACTIVE_STATUSES } } }),
    prisma.inquiry.count({ where: { ...inquiryBase, status: "GOTOWE_DO_WYCENY" } }),
    prisma.inquiry.count({ where: { ...inquiryBase, status: "OCZEKUJE_NA_DECYZJE" } }),
  ]);

  return NextResponse.json({
    criticalAlerts,
    openAlerts,
    overdueOrders,
    todayOrders,
    pendingMaintenance,
    waitingOrders,
    unsettledOrders,
    overdueOrdersList,
    todaySimpleTasks,
    recentActivity,
    inquiryStats: {
      new: inquiryNew,
      active: inquiryActive,
      toQuote: inquiryToQuote,
      waitingDecision: inquiryWaiting,
    },
  });
  } catch (err) {
    console.error("[dashboard] ERROR:", err);
    return NextResponse.json({ error: "Dashboard error", message: String(err) }, { status: 500 });
  }
}
