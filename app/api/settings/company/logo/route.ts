import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("logo") as File | null;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const allowed = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Nieprawidłowy format. Dopuszczalne: PNG, JPG, SVG, WebP" }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Plik za duży (max 2 MB)" }, { status: 400 });
  }

  const ext = file.type === "image/svg+xml" ? "svg" : file.name.split(".").pop() ?? "png";
  const filename = `company-logo.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "company");
  await mkdir(uploadDir, { recursive: true });
  const bytes = await file.arrayBuffer();
  await writeFile(path.join(uploadDir, filename), Buffer.from(bytes));

  const logoUrl = `/uploads/company/${filename}`;

  await prisma.companySettings.upsert({
    where: { id: 1 },
    update: { logoUrl },
    create: { id: 1, logoUrl },
  });

  return NextResponse.json({ data: { logoUrl } });
}
