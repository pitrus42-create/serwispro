import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string; mid: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: orderId, mid } = await params;

  const material = await prisma.orderMaterial.findUnique({ where: { id: mid } });
  if (!material || material.orderId !== orderId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.orderMaterial.delete({ where: { id: mid } });
  return NextResponse.json({ success: true });
}
