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
  const { name, description, itemType = "SPRZET", quantity = 1, unit = "szt", netPrice = 0, vatRate = 23, modelName } = body;
  if (!name) return NextResponse.json({ error: "Nazwa wymagana" }, { status: 400 });
  const item = await prisma.quoteTemplateItem.create({
    data: { packageId: pid, name, description: description ?? null, itemType, quantity: parseFloat(quantity), unit, netPrice: parseFloat(netPrice), vatRate: parseFloat(vatRate), modelName: modelName ?? null },
  });
  return NextResponse.json(item, { status: 201 });
}
