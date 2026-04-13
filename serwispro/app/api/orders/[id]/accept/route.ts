import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, getClientIp } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

// POST /api/orders/[id]/accept
// Serwisant przyjmuje nieprzypisane zlecenie (dodaje siebie jako lead)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { assignments: true },
  });

  if (!order) return NextResponse.json({ error: "Nie znaleziono zlecenia" }, { status: 404 });

  // Nie można przyjąć zakończonego ani anulowanego
  if (["ZAKONCZONE", "ANULOWANE"].includes(order.status)) {
    return NextResponse.json({ error: "Zlecenie jest już zamknięte" }, { status: 422 });
  }

  // Sprawdź czy użytkownik już nie jest przypisany
  const alreadyAssigned = order.assignments.some((a) => a.userId === session.user.id);
  if (alreadyAssigned) {
    return NextResponse.json({ error: "Jesteś już przypisany do tego zlecenia" }, { status: 422 });
  }

  // Dodaj użytkownika jako lead (lub helper jeśli jest już lead)
  const hasLead = order.assignments.some((a) => a.isLead);

  await prisma.orderAssignment.create({
    data: {
      orderId: id,
      userId: session.user.id,
      isLead: !hasLead, // pierwszy przypisany = lead
    },
  });

  // Zmień status na PRZYJETE jeśli OCZEKUJACE
  if (order.status === "OCZEKUJACE") {
    await prisma.order.update({
      where: { id },
      data: { status: "PRZYJETE" },
    });
  }

  await logAudit({
    userId: session.user.id,
    action: "ORDER_ACCEPTED",
    entityType: "Order",
    entityId: id,
    details: JSON.stringify({ orderNumber: order.orderNumber }),
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ success: true });
}
