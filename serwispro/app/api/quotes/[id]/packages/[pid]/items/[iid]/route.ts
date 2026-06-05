import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function recalcPackage(packageId: string) {
  const items = await prisma.quoteItem.findMany({ where: { packageId } });
  const netTotal = items.reduce((s, i) => s + i.netPrice * i.quantity, 0);
  const grossTotal = items.reduce((s, i) => s + i.grossPrice * i.quantity, 0);
  await prisma.quotePackage.update({
    where: { id: packageId },
    data: { netTotal, grossTotal },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string; iid: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pid, iid } = await params;
  const body = await req.json();
  const { name, description, itemType, quantity, unit, netPrice, vatRate, isVisibleToClient, modelName, photoUrl } = body;

  const np = netPrice !== undefined ? parseFloat(netPrice) : undefined;
  const vat = vatRate !== undefined ? parseFloat(vatRate) : undefined;
  const gp = np !== undefined && vat !== undefined ? np * (1 + vat / 100) : undefined;

  const item = await prisma.quoteItem.update({
    where: { id: iid },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(itemType !== undefined ? { itemType } : {}),
      ...(quantity !== undefined ? { quantity: parseFloat(quantity) } : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(np !== undefined ? { netPrice: np } : {}),
      ...(vat !== undefined ? { vatRate: vat } : {}),
      ...(gp !== undefined ? { grossPrice: gp } : {}),
      ...(isVisibleToClient !== undefined ? { isVisibleToClient } : {}),
      ...(modelName !== undefined ? { modelName } : {}),
      ...(photoUrl !== undefined ? { photoUrl } : {}),
    },
  });

  await recalcPackage(pid);

  return NextResponse.json(item);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string; iid: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pid, iid } = await params;

  const item = await prisma.quoteItem.findUnique({ where: { id: iid } });
  if (!item) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  await prisma.quoteItem.delete({ where: { id: iid } });
  await recalcPackage(pid);

  return NextResponse.json({ success: true });
}
