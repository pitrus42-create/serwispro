import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const item = await prisma.stockItem.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.sku !== undefined && { sku: body.sku }),
      ...(body.unit !== undefined && { unit: body.unit }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
    },
    include: { category: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ data: item });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.stockItem.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
