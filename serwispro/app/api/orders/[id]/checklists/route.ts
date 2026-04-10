import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: orderId } = await params;

  const { templateId } = await req.json();
  const template = await prisma.checklistTemplate.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { itemOrder: "asc" } } },
  });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const checklist = await prisma.orderChecklist.create({
    data: {
      orderId,
      templateId,
      name: template.name,
      items: {
        create: template.items.map((item) => ({
          text: item.text,
          itemOrder: item.itemOrder,
        })),
      },
    },
    include: { items: { orderBy: { itemOrder: "asc" } } },
  });

  return NextResponse.json({ data: checklist }, { status: 201 });
}
