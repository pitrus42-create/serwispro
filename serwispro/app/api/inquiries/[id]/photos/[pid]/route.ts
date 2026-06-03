import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, pid } = await params;

  const photo = await prisma.inquiryPhoto.findUnique({ where: { id: pid } });
  if (!photo || photo.inquiryId !== id) {
    return NextResponse.json({ error: "Nie znaleziono zdjęcia" }, { status: 404 });
  }

  await deleteFile(photo.fileUrl);
  await prisma.inquiryPhoto.delete({ where: { id: pid } });

  const actorLabel = `${session.user.firstName} ${session.user.lastName}`;
  await prisma.inquiryChangeLog.create({
    data: {
      inquiryId: id,
      userId: session.user.id,
      actorLabel,
      changeType: "PHOTO_REMOVED",
      description: `Usunięto zdjęcie: ${photo.fileName ?? pid}`,
    },
  });

  return NextResponse.json({ success: true });
}
