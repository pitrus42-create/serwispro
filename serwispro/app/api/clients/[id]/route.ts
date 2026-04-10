import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      locations: { where: { isActive: true }, orderBy: { name: "asc" } },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          assignments: {
            where: { isLead: true },
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      },
      attachments: { orderBy: { uploadedAt: "desc" } },
    },
  });

  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: client });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const client = await prisma.client.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.nip !== undefined && { nip: body.nip }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.phoneAlt !== undefined && { phoneAlt: body.phoneAlt }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.alias !== undefined && { alias: body.alias }),
      ...(body.notes !== undefined && { notes: body.notes }),
    },
  });
  return NextResponse.json({ data: client });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await prisma.client.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ message: "Deactivated" });
}
