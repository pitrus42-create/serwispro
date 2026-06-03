import { auth, getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getAuth(req);
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
  const session = await getAuth(req);
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
    estimatedDuration, difficulty,
    responsibleId,
  } = body;

  const updated = await prisma.order.update({
    where: { id },
    data: {
      ...(type !== undefined && { type }),
      ...(priority !== undefined && { priority }),
      ...(isCritical !== undefined && { isCritical }),
      ...(clientId !== undefined && { clientId }),
      ...(locationId !== undefined && { locationId: locationId || null }),
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(internalNotes !== undefined && { internalNotes }),
      ...(scheduledAt !== undefined && { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }),
      ...(scheduledEndAt !== undefined && { scheduledEndAt: scheduledEndAt ? new Date(scheduledEndAt) : null }),
      ...(dayOrder !== undefined && { dayOrder }),
      ...(estimatedDuration !== undefined && { estimatedDuration: estimatedDuration || null }),
      ...(difficulty !== undefined && { difficulty: difficulty || null }),
    },
    include: {
      client: { select: { name: true } },
      assignments: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
    },
  });

  // Update lead assignment when responsibleId is explicitly provided
  if (responsibleId !== undefined) {
    await prisma.orderAssignment.updateMany({
      where: { orderId: id, isLead: true },
      data: { isLead: false },
    });
    if (responsibleId) {
      const existing = await prisma.orderAssignment.findUnique({
        where: { orderId_userId: { orderId: id, userId: responsibleId } },
      });
      if (existing) {
        await prisma.orderAssignment.update({
          where: { orderId_userId: { orderId: id, userId: responsibleId } },
          data: { isLead: true },
        });
      } else {
        await prisma.orderAssignment.create({
          data: { orderId: id, userId: responsibleId, isLead: true },
        });
      }
    }
  }

  const changedFields = Object.keys(body).filter((k) => k !== "responsibleId");
  const details: Record<string, unknown> = { fields: changedFields };
  if (responsibleId !== undefined) details.responsibleId = responsibleId;

  await prisma.orderActivityLog.create({
    data: {
      orderId: id,
      userId: session.user.id,
      action: "order_updated",
      details: JSON.stringify(details),
    },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  if (!isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.order.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
