import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const inquiry = await prisma.inquiry.findUnique({ where: { publicToken: token } });
  if (!inquiry) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  const formData = await req.formData();
  const files = formData.getAll("photos") as File[];
  // Kategoria może być pojedyncza (dla wszystkich) albo JSON array (po jednej na plik)
  const categoryRaw = formData.get("category") as string | null;
  const categoriesRaw = formData.get("categories") as string | null;
  const descriptionsRaw = formData.get("descriptions") as string | null;

  const categories: string[] = categoriesRaw
    ? JSON.parse(categoriesRaw)
    : files.map(() => categoryRaw ?? "INNE");

  const descriptions: string[] = descriptionsRaw
    ? JSON.parse(descriptionsRaw)
    : files.map(() => "");

  if (!files.length) return NextResponse.json({ error: "Brak zdjęć" }, { status: 400 });

  const uploaded: object[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() ?? "jpg";
    const storagePath = `uploads/inquiries/${inquiry.id}/${randomUUID()}.${ext}`;
    const fileUrl = await uploadFile(storagePath, buffer, file.type || "image/jpeg");

    const photo = await prisma.inquiryPhoto.create({
      data: {
        inquiryId: inquiry.id,
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        category: categories[i] ?? "INNE",
        description: descriptions[i] || null,
        addedBy: "CLIENT",
      },
    });

    uploaded.push(photo);
  }

  await prisma.inquiryChangeLog.create({
    data: {
      inquiryId: inquiry.id,
      actorLabel: inquiry.contactName,
      changeType: "PHOTO_ADDED",
      description: `Klient dodał ${files.length} zdjęcie(a) przez link`,
    },
  });

  return NextResponse.json(uploaded, { status: 201 });
}
