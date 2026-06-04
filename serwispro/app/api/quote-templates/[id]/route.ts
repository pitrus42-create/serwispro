import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const template = await prisma.quoteTemplate.findUnique({
    where: { id },
    include: { packages: { include: { items: true } } },
  });
  if (!template) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });
  return NextResponse.json(template);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const { name, serviceType, description, conditions, internalNotes } = body;
  const template = await prisma.quoteTemplate.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(serviceType !== undefined ? { serviceType } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(conditions !== undefined ? { conditions } : {}),
      ...(internalNotes !== undefined ? { internalNotes } : {}),
    },
    include: { packages: { include: { items: true } } },
  });
  return NextResponse.json(template);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.quoteTemplate.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
