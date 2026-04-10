import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { name, content } = await req.json();

  const template = await prisma.protocolTemplate.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(content !== undefined && { content }),
    },
  });

  return NextResponse.json({ data: template });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await prisma.protocolTemplate.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
