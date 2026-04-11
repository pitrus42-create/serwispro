import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const userId = searchParams.get("userId");

  const admin = isAdmin(session.user);

  // Admins and managers see all or filtered by userId param
  // Serwisants see ALL orders (to know team schedule) — isMyOrder flag differentiates theirs
  const assignmentsFilter = admin
    ? userId ? { assignments: { some: { userId } } } : {}
    : {}; // serwisant sees all

  const orders = await prisma.order.findMany({
    where: {
      scheduledAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      },
      status: { not: "ZAKONCZONE" },
      ...assignmentsFilter,
    },
    include: {
      client: { select: { name: true } },
      location: { select: { address: true, city: true } },
      assignments: {
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const events = orders.map((order) => {
    const lead = order.assignments.find((a) => a.isLead);
    const address = order.location
      ? `${order.location.address ?? ""} ${order.location.city ?? ""}`.trim()
      : "";

    return {
      id: order.id,
      title: order.title ?? order.client?.name ?? order.orderNumber,
      start: order.scheduledAt,
      end: order.scheduledEndAt ?? order.scheduledAt,
      extendedProps: {
        orderNumber: order.orderNumber,
        type: order.type,
        status: order.status,
        priority: order.priority,
        isCritical: order.isCritical,
        clientName: order.client?.name,
        address,
        leadName: lead ? `${lead.user.firstName} ${lead.user.lastName}` : null,
        isMyOrder: order.assignments.some((a) => a.user.id === session.user.id),
        assignees: order.assignments.map((a) => ({
          id: a.user.id,
          name: `${a.user.firstName} ${a.user.lastName}`,
          isLead: a.isLead,
        })),
      },
    };
  });

  return NextResponse.json({ data: events });
}
