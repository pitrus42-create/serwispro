import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const { name, description, itemType, unit, defaultNetPrice, vatRate, modelName, isActive, photoUrl, showPhotoInQuote } = body;
  const item = await prisma.productCatalogItem.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(itemType !== undefined ? { itemType } : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(defaultNetPrice !== undefined ? { defaultNetPrice: parseFloat(defaultNetPrice) } : {}),
      ...(vatRate !== undefined ? { vatRate: parseFloat(vatRate) } : {}),
      ...(modelName !== undefined ? { modelName } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(photoUrl !== undefined ? { photoUrl } : {}),
      ...(showPhotoInQuote !== undefined ? { showPhotoInQuote: Boolean(showPhotoInQuote) } : {}),
    },
  });
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.productCatalogItem.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
