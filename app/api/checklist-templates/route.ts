import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  const templates = await prisma.checklistTemplate.findMany({
    where: {
      isActive: true,
      ...(type ? { OR: [{ orderType: type }, { orderType: null }] } : {}),
    },
    include: { items: { orderBy: { itemOrder: "asc" } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: templates });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, orderType, items = [] } = await req.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const template = await prisma.checklistTemplate.create({
    data: {
      name,
      orderType: orderType ?? null,
      createdBy: session.user.id,
      items: {
        create: items.map((item: { text: string; itemOrder: number; isRequired?: boolean }) => ({
          text: item.text,
          itemOrder: item.itemOrder,
          isRequired: item.isRequired ?? false,
        })),
      },
    },
    include: { items: { orderBy: { itemOrder: "asc" } } },
  });

  return NextResponse.json({ data: template }, { status: 201 });
}
