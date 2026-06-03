import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const item = await prisma.galleryItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  const formData = await req.formData();
  const files = formData.getAll("photos") as File[];
  const caption = formData.get("caption") as string | null;
  const isMain = formData.get("isMain") === "true";

  const uploaded = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() ?? "jpg";
    const storagePath = `uploads/gallery/${id}/${randomUUID()}.${ext}`;
    const fileUrl = await uploadFile(storagePath, buffer, file.type || "image/jpeg");

    const photo: Awaited<ReturnType<typeof prisma.galleryPhoto.create>> = await prisma.galleryPhoto.create({
      data: {
        galleryItemId: id,
        fileUrl,
        fileName: file.name,
        caption: caption ?? null,
        isMain: isMain && uploaded.length === 0, // tylko pierwsze jako główne
      },
    });
    uploaded.push(photo);
  }

  return NextResponse.json(uploaded, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const photoId = searchParams.get("photoId");
  if (!photoId) return NextResponse.json({ error: "photoId wymagany" }, { status: 400 });
  await prisma.galleryPhoto.delete({ where: { id: photoId } });
  return NextResponse.json({ success: true });
}
