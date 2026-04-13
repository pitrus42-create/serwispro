import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = (session.user.roles as string[]) ?? [];
  const canSettle = isAdmin(session.user) || roles.includes("MENEDZER");
  if (!canSettle) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.order.update({
    where: { id },
    data: { isSettled: true, settledAt: new Date() },
  });

  await prisma.orderActivityLog.create({
    data: {
      orderId: id,
      userId: session.user.id,
      action: "order_settled",
      details: JSON.stringify({ settledAt: updated.settledAt }),
    },
  });

  return NextResponse.json({ data: updated });
}
