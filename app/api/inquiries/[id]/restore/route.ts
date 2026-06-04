import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const actorLabel = `${session.user.firstName} ${session.user.lastName}`;

  const existing = await prisma.inquiry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  await prisma.inquiry.update({
    where: { id },
    data: {
      archivedAt: null,
      archivedBy: null,
      deletedAt: null,
      deletedBy: null,
    },
  });

  await prisma.inquiryChangeLog.create({
    data: {
      inquiryId: id,
      userId: session.user.id,
      actorLabel,
      changeType: "RESTORED",
      description: `Zapytanie przywrócone przez ${actorLabel}`,
    },
  });

  return NextResponse.json({ success: true });
}
