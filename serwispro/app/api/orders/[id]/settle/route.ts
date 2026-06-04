import { auth, getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = (session.user.roles as string[]) ?? [];
  const canSettle = isAdmin(session.user) || roles.includes("MENEDZER");
  if (!canSettle) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { settledCost, settledProfit, billingNotes } = body;

  const updated = await prisma.order.update({
    where: { id },
    data: {
      isSettled: true,
      settledAt: new Date(),
      ...(settledCost !== undefined && { settledCost: settledCost !== "" ? Number(settledCost) : null }),
      ...(settledProfit !== undefined && { settledProfit: settledProfit !== "" ? Number(settledProfit) : null }),
      ...(billingNotes !== undefined && { billingNotes: billingNotes || null }),
    },
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

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = (session.user.roles as string[]) ?? [];
  const canSettle = isAdmin(session.user) || roles.includes("MENEDZER");
  if (!canSettle) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || !order.isSettled) return NextResponse.json({ error: "Not found or not settled" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { settledCost, settledProfit, billingNotes } = body;

  const updated = await prisma.order.update({
    where: { id },
    data: {
      ...(settledCost !== undefined && { settledCost: settledCost !== "" && settledCost !== null ? Number(settledCost) : null }),
      ...(settledProfit !== undefined && { settledProfit: settledProfit !== "" && settledProfit !== null ? Number(settledProfit) : null }),
      ...(billingNotes !== undefined && { billingNotes: billingNotes || null }),
    },
  });

  return NextResponse.json({ data: updated });
}
