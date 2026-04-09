import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
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

  const uploadDir = path.join(process.cwd(), "public", "uploads", "orders", orderId, "protocols", pid);
  await mkdir(uploadDir, { recursive: true });

  const photos = [];
  for (const file of files.slice(0, 6)) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const filename = `${uuidv4()}.${ext}`;
    const bytes = await file.arrayBuffer();
    await writeFile(path.join(uploadDir, filename), Buffer.from(bytes));

    const photo = await prisma.protocolPhoto.create({
      data: {
        protocolId: pid,
        fileUrl: `/uploads/orders/${orderId}/protocols/${pid}/${filename}`,
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
