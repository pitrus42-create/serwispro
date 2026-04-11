import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

type Params = { params: Promise<{ id: string; pid: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { pid } = await params;

  const photos = await prisma.protocolPhoto.findMany({
    where: { protocolId: pid },
    orderBy: { uploadedAt: "asc" },
  });

  return NextResponse.json({ data: photos });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: orderId, pid } = await params;

  const formData = await req.formData();
  const files = formData.getAll("photos") as File[];

  if (!files.length) return NextResponse.json({ error: "No photos" }, { status: 400 });

  const photos = [];
  for (const file of files.slice(0, 6)) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const filename = `${uuidv4()}.${ext}`;
    const storagePath = `uploads/orders/${orderId}/protocols/${pid}/${filename}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const fileUrl = await uploadFile(storagePath, buffer, file.type || "image/jpeg");

    const photo = await prisma.protocolPhoto.create({
      data: {
        protocolId: pid,
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadedBy: session.user.id,
      },
    });
    photos.push(photo);
  }

  return NextResponse.json({ data: photos }, { status: 201 });
}
