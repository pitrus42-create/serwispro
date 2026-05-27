import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getAuth(req);
  if (!session || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { userId, isLead = false } = await req.json();

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { assignments: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (["ZAKONCZONE", "ANULOWANE"].includes(order.status)) {
    return NextResponse.json({ error: "Zlecenie jest zamknięte" }, { status: 422 });
  }

  const alreadyAssigned = order.assignments.some((a) => a.userId === userId);
  if (alreadyAssigned) {
    return NextResponse.json({ error: "Użytkownik jest już przypisany" }, { status: 422 });
  }

  if (isLead) {
    await prisma.orderAssignment.updateMany({
      where: { orderId: id, isLead: true },
      data: { isLead: false },
    });
  }

  await prisma.orderAssignment.create({
    data: { orderId: id, userId, isLead },
  });

  await prisma.orderActivityLog.create({
    data: {
      orderId: id,
      userId: session.user.id,
      action: "assignment_added",
      details: JSON.stringify({ userId, isLead }),
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getAuth(req);
  if (!session || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const userId = new URL(req.url).searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { assignments: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (["ZAKONCZONE", "ANULOWANE"].includes(order.status)) {
    return NextResponse.json({ error: "Zlecenie jest zamknięte" }, { status: 422 });
  }

  await prisma.orderAssignment.deleteMany({
    where: { orderId: id, userId },
  });

  await prisma.orderActivityLog.create({
    data: {
      orderId: id,
      userId: session.user.id,
      action: "assignment_removed",
      details: JSON.stringify({ userId }),
    },
  });

  return NextResponse.json({ success: true });
}
