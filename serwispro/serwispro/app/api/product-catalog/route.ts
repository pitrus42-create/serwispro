import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const itemType = searchParams.get("itemType");

  const items = await prisma.productCatalogItem.findMany({
    where: {
      isActive: true,
      ...(itemType ? { itemType } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { modelName: { contains: q } }, { description: { contains: q } }] } : {}),
    },
    orderBy: { name: "asc" },
    take: 50,
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, description, itemType = "SPRZET", unit = "szt", defaultNetPrice = 0, vatRate = 23, modelName } = body;

  if (!name) return NextResponse.json({ error: "Nazwa jest wymagana" }, { status: 400 });

  const item = await prisma.productCatalogItem.create({
    data: {
      name, description: description ?? null, itemType, unit,
      defaultNetPrice: parseFloat(defaultNetPrice),
      vatRate: parseFloat(vatRate),
      modelName: modelName ?? null,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
