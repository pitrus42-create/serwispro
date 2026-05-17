import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: orderId } = await params;

  const { stockItemId, manualName, quantity, unit, unitPrice, notes } = await req.json();

  if (!stockItemId && !manualName) {
    return NextResponse.json({ error: "stockItemId or manualName required" }, { status: 400 });
  }

  const material = await prisma.orderMaterial.create({
    data: {
      orderId,
      stockItemId: stockItemId ?? null,
      manualName: manualName ?? null,
      quantity: quantity ?? null,
      unit: unit ?? null,
      unitPrice: unitPrice ?? null,
      notes: notes ?? null,
      addedBy: session.user.id,
    },
    include: { stockItem: { select: { name: true, unit: true } } },
  });

  return NextResponse.json({ data: material }, { status: 201 });
}
