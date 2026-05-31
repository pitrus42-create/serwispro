import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string; attId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: orderId, attId } = await params;

  const att = await prisma.orderAttachment.findUnique({ where: { id: attId } });
  if (!att || att.orderId !== orderId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await deleteFile(att.fileUrl);
  } catch {
    // ignore storage errors — still delete the DB record
  }

  await prisma.orderAttachment.delete({ where: { id: attId } });
  return NextResponse.json({ success: true });
}
