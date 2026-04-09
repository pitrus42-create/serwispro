import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const categoryId = searchParams.get("categoryId");

  const where: Prisma.StockItemWhereInput = { isActive: true };
  if (categoryId) where.categoryId = categoryId;
  if (q) where.OR = [{ name: { contains: q } }, { sku: { contains: q } }];

  const items = await prisma.stockItem.findMany({
    where,
    include: { category: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: items });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, sku, unit, notes, categoryId } = body;
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const item = await prisma.stockItem.create({
    data: {
      name,
      sku: sku ?? null,
      unit: unit ?? "szt",
      notes: notes ?? null,
      categoryId: categoryId ?? null,
    },
    include: { category: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ data: item }, { status: 201 });
}
