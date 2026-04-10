import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: orderId } = await params;

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 });

  const uploadDir = path.join(process.cwd(), "public", "uploads", "orders", orderId);
  await mkdir(uploadDir, { recursive: true });

  const attachments = [];
  for (const file of files.slice(0, 20)) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const filename = `${uuidv4()}.${ext}`;
    const bytes = await file.arrayBuffer();
    await writeFile(path.join(uploadDir, filename), Buffer.from(bytes));

    const att = await prisma.orderAttachment.create({
      data: {
        orderId,
        fileUrl: `/uploads/orders/${orderId}/${filename}`,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadedBy: session.user.id,
      },
    });
    attachments.push(att);
  }

  return NextResponse.json({ data: attachments }, { status: 201 });
}
