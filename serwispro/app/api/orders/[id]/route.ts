import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      client: true,
      location: true,
      assignments: {
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      },
      checklists: { include: { items: { orderBy: { itemOrder: "asc" } } } },
      materials: {
        include: { stockItem: { select: { name: true, unit: true } } },
      },
      attachments: true,
      protocols: { orderBy: { createdAt: "desc" } },
      activityLog: {
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ data: order });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id }, include: { assignments: true } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = isAdmin(session.user);
  const isAssigned = order.assignments.some((a) => a.userId === session.user.id);
  const perms = session.user.permissions as Record<string, boolean>;

  if (!admin && !isAssigned && !perms.canEditAllOrders) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status === "ZAKONCZONE" && !admin && !perms.canEditClosedOrders) {
    return NextResponse.json({ error: "Forbidden: order is closed" }, { status: 403 });
  }

  const body = await req.json();
  const {
    type, priority, isCritical, clientId, locationId,
    title, description, internalNotes, scheduledAt, scheduledEndAt, dayOrder,
  } = body;

  const updated = await prisma.order.update({
    where: { id },
    data: {
      ...(type !== undefined && { type }),
      ...(priority !== undefined && { priority }),
      ...(isCritical !== undefined && { isCritical }),
      ...(clientId !== undefined && { clientId }),
      ...(locationId !== undefined && { locationId }),
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(internalNotes !== undefined && { internalNotes }),
      ...(scheduledAt !== undefined && { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }),
      ...(scheduledEndAt !== undefined && { scheduledEndAt: scheduledEndAt ? new Date(scheduledEndAt) : null }),
      ...(dayOrder !== undefined && { dayOrder }),
    },
    include: {
      client: { select: { name: true } },
      assignments: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
    },
  });

  await prisma.orderActivityLog.create({
    data: {
      orderId: id,
      userId: session.user.id,
      action: "order_updated",
      details: JSON.stringify({ fields: Object.keys(body) }),
    },
  });

  return NextResponse.json({ data: updated });
}
