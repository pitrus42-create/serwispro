import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { deleteFile } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string; pid: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAdmin(session.user)) {
    return NextResponse.json(
      { error: "Forbidden", message: "Usuwanie protokołów wymaga uprawnień administratora." },
      { status: 403 }
    );
  }

  const { id: orderId, pid } = await params;

  const protocol = await prisma.protocol.findUnique({
    where: { id: pid },
    include: { photos: true },
  });

  if (!protocol || protocol.orderId !== orderId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete photo files from storage (Firebase or local)
  for (const photo of protocol.photos) {
    await deleteFile(photo.fileUrl);
  }

  // Delete protocol (photos cascade via Prisma)
  await prisma.protocol.delete({ where: { id: pid } });

  await prisma.orderActivityLog.create({
    data: {
      orderId,
      userId: session.user.id,
      action: "protocol_deleted",
      details: JSON.stringify({ protocolNumber: protocol.protocolNumber }),
    },
  });

  return NextResponse.json({ success: true });
}
