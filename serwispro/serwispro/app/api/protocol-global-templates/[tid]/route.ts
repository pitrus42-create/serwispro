import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ tid: string }> };

function deserialize(t: {
  id: string;
  name: string;
  defaultText: string;
  defaultChecklist: string;
  defaultNotes: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return { ...t, defaultChecklist: JSON.parse(t.defaultChecklist ?? "[]") };
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tid } = await params;
  const body = await req.json();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Nazwa jest wymagana" }, { status: 400 });
  }

  const existing = await prisma.protocolGlobalTemplate.findUnique({ where: { id: tid } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.protocolGlobalTemplate.update({
    where: { id: tid },
    data: {
      name: body.name.trim(),
      defaultText: body.defaultText ?? "",
      defaultChecklist: JSON.stringify(body.defaultChecklist ?? []),
      defaultNotes: body.defaultNotes ?? "",
    },
  });

  return NextResponse.json({ data: deserialize(updated) });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tid } = await params;

  const existing = await prisma.protocolGlobalTemplate.findUnique({ where: { id: tid } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.protocolGlobalTemplate.delete({ where: { id: tid } });
  return NextResponse.json({ ok: true });
}
