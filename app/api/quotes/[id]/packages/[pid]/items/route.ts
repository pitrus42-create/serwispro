import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pid } = await params;
  const body = await req.json();
  const {
    name, description, itemType = "SPRZET", quantity = 1, unit = "szt",
    netPrice = 0, vatRate = 23, isVisibleToClient = true, modelName, photoUrl,
  } = body;

  if (!name) return NextResponse.json({ error: "Nazwa jest wymagana" }, { status: 400 });

  const grossPrice = netPrice * (1 + vatRate / 100);

  const item = await prisma.quoteItem.create({
    data: {
      packageId: pid,
      name,
      description: description ?? null,
      itemType,
      quantity: parseFloat(quantity),
      unit,
      netPrice: parseFloat(netPrice),
      vatRate: parseFloat(vatRate),
      grossPrice,
      isVisibleToClient,
      modelName: modelName ?? null,
      photoUrl: photoUrl ?? null,
    },
  });

  // Przelicz sumy pakietu
  await recalcPackage(pid);

  return NextResponse.json(item, { status: 201 });
}

async function recalcPackage(packageId: string) {
  const items = await prisma.quoteItem.findMany({ where: { packageId } });
  const netTotal = items.reduce((s, i) => s + i.netPrice * i.quantity, 0);
  const grossTotal = items.reduce((s, i) => s + i.grossPrice * i.quantity, 0);
  await prisma.quotePackage.update({
    where: { id: packageId },
    data: { netTotal, grossTotal },
  });
}
