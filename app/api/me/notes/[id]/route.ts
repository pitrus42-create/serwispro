import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Only allow deleting own notes
  const note = await prisma.userNote.findUnique({ where: { id } });
  if (!note || note.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.userNote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
