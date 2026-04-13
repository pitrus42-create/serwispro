import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

type Params = { params: Promise<{ id: string; pid: string }> };

export const maxDuration = 60; // allow up to 60s for large photo uploads

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
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id: orderId, pid } = await params;

    console.log(`[photos] POST orderId=${orderId} pid=${pid}`);
    console.log(`[photos] FIREBASE_STORAGE_BUCKET=${process.env.FIREBASE_STORAGE_BUCKET ?? "NOT SET"}`);

    const formData = await req.formData();
    const files = formData.getAll("photos") as File[];

    console.log(`[photos] files count=${files.length}`);

    if (!files.length) return NextResponse.json({ error: "No photos" }, { status: 400 });

    const photos = [];
    for (const file of files.slice(0, 6)) {
      console.log(`[photos] uploading file name=${file.name} size=${file.size} type=${file.type}`);
      const ext = file.name.split(".").pop() ?? "jpg";
      const filename = `${uuidv4()}.${ext}`;
      const storagePath = `uploads/orders/${orderId}/protocols/${pid}/${filename}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const fileUrl = await uploadFile(storagePath, buffer, file.type || "image/jpeg");
      console.log(`[photos] uploaded → ${fileUrl}`);

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
  } catch (err) {
    console.error("[photos] ERROR:", err);
    return NextResponse.json(
      { error: "Upload failed", message: String(err) },
      { status: 500 }
    );
  }
}
