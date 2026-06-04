import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = (session.user.roles as string[]) ?? [];
  if (!roles.includes("SUPERADMIN")) {
    return NextResponse.json({ error: "Brak uprawnień — wymagany SUPERADMIN" }, { status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.inquiry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  await prisma.inquiry.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
