import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/order-number";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/permissions";
import { startOfDay } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status")?.split(",").filter(Boolean);
  const type = searchParams.get("type")?.split(",").filter(Boolean);
  const priority = searchParams.get("priority")?.split(",").filter(Boolean);
  const userId = searchParams.get("userId");
  const clientId = searchParams.get("clientId");
  const critical = searchParams.get("critical");
  const overdue = searchParams.get("overdue");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const q = searchParams.get("q");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");

  const admin = isAdmin(session.user);

  const where = {
    ...(!admin && !(session.user.permissions as Record<string, boolean>)?.canViewAllOrders
      ? { assignments: { some: { userId: session.user.id } } }
      : userId
      ? { assignments: { some: { userId } } }
      : {}),
    ...(status?.length ? { status: { in: status } } : {}),
    ...(type?.length ? { type: { in: type } } : {}),
    ...(priority?.length ? { priority: { in: priority } } : {}),
    ...(clientId ? { clientId } : {}),
    ...(critical === "true" ? { isCritical: true } : {}),
    ...(overdue === "true"
      ? { scheduledAt: { lt: startOfDay(new Date()) }, status: { in: ["OCZEKUJACE", "PRZYJETE", "W_TOKU"] } }
      : dateFrom || dateTo
      ? { scheduledAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } }
      : {}),
    ...(q ? { OR: [{ orderNumber: { contains: q } }, { title: { contains: q } }, { description: { contains: q } }] } : {}),
  };

  const [total, data] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        location: { select: { id: true, name: true, address: true, city: true } },
        assignments: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: [
        { isCritical: "desc" },
        { scheduledAt: "asc" },
        { createdAt: "desc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ data, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    type,
    priority = "NORMALNY",
    isCritical = false,
    clientId,
    locationId,
    title,
    description,
    internalNotes,
    scheduledAt,
    scheduledEndAt,
    dayOrder,
    responsibleId,
    helperIds = [],
  } = body;

  if (!type) return NextResponse.json({ error: "type is required" }, { status: 400 });

  const orderNumber = await generateOrderNumber();

  const order = await prisma.order.create({
    data: {
      orderNumber,
      type,
      priority,
      isCritical: type === "AWARIA" ? isCritical : false,
      clientId: clientId ?? null,
      locationId: locationId ?? null,
      title: title ?? null,
      description: description ?? null,
      internalNotes: internalNotes ?? null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      scheduledEndAt: scheduledEndAt ? new Date(scheduledEndAt) : null,
      dayOrder: dayOrder ?? null,
      createdById: session.user.id,
      assignments: {
        create: [
          ...(responsibleId ? [{ userId: responsibleId, isLead: true }] : []),
          ...helperIds.map((uid: string) => ({ userId: uid, isLead: false })),
        ],
      },
    },
    include: {
      client: true,
      location: true,
      assignments: { include: { user: true } },
    },
  });

  // Activity log
  await prisma.orderActivityLog.create({
    data: {
      orderId: order.id,
      userId: session.user.id,
      action: "order_created",
      details: JSON.stringify({ type, priority, isCritical }),
    },
  });

  // Notifications
  const assignedUserIds = order.assignments.map((a) => a.userId);
  const notifyIds = assignedUserIds.filter((id) => id !== session.user.id);

  if (notifyIds.length) {
    await createNotification({
      userIds: notifyIds,
      type: "order_assigned",
      priority: 3,
      title: `Przypisano Cię do zlecenia ${orderNumber}`,
      message: title ?? description ?? undefined,
      link: `/orders/${order.id}`,
      relatedEntityType: "order",
      relatedEntityId: order.id,
    });
  }

  if (isCritical && type === "AWARIA") {
    await notifyAdmins({
      type: "critical_failure",
      priority: 1,
      title: `🔴 AWARIA KRYTYCZNA: ${order.client?.name ?? "Klient"}`,
      message: title ?? description ?? "Nowa awaria krytyczna",
      link: `/orders/${order.id}`,
      relatedEntityType: "order",
      relatedEntityId: order.id,
    });
  }

  return NextResponse.json({ data: order }, { status: 201 });
}
