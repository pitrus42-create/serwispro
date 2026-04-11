import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: orderId } = await params;

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 });

  const attachments = [];
  for (const file of files.slice(0, 20)) {
    const ext = file.name.split(".").pop() ?? "bin";
    const filename = `${uuidv4()}.${ext}`;
    const storagePath = `uploads/orders/${orderId}/${filename}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const fileUrl = await uploadFile(storagePath, buffer, file.type || "application/octet-stream");

    const att = await prisma.orderAttachment.create({
      data: {
        orderId,
        fileUrl,
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
