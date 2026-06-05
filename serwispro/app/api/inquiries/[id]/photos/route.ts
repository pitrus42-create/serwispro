import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const photos = await prisma.inquiryPhoto.findMany({
    where: { inquiryId: id },
    orderBy: { addedAt: "asc" },
  });

  return NextResponse.json(photos);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const inquiry = await prisma.inquiry.findUnique({ where: { id } });
  if (!inquiry) return NextResponse.json({ error: "Nie znaleziono zapytania" }, { status: 404 });

  const formData = await req.formData();
  const files = formData.getAll("photos") as File[];
  const category = formData.get("category") as string | null;
  const description = formData.get("description") as string | null;

  if (!files.length) return NextResponse.json({ error: "Brak zdjęć" }, { status: 400 });

  const actorLabel = `${session.user.firstName} ${session.user.lastName}`;
  const uploaded: object[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() ?? "jpg";
    const storagePath = `uploads/inquiries/${id}/${randomUUID()}.${ext}`;
    const fileUrl = await uploadFile(storagePath, buffer, file.type || "image/jpeg");

    const photo = await prisma.inquiryPhoto.create({
      data: {
        inquiryId: id,
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        category: category ?? null,
        description: description ?? null,
        addedBy: session.user.id,
      },
    });

    uploaded.push(photo);
  }

  await prisma.inquiryChangeLog.create({
    data: {
      inquiryId: id,
      userId: session.user.id,
      actorLabel,
      changeType: "PHOTO_ADDED",
      description: `Dodano ${files.length} zdjęcie(a) przez ${actorLabel}`,
    },
  });

  return NextResponse.json(uploaded, { status: 201 });
}
