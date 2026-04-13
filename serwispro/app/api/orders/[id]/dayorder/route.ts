import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { dayOrder } = await req.json();

  const updated = await prisma.order.update({
    where: { id },
    data: { dayOrder: typeof dayOrder === "number" ? dayOrder : null },
  });

  return NextResponse.json({ data: updated });
}
