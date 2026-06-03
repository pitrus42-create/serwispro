import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.galleryItem.findMany({
    orderBy: { createdAt: "desc" },
    include: { photos: { orderBy: [{ isMain: "desc" }, { uploadedAt: "asc" }] } },
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, description, serviceType, category, isPublic = true } = body;

  if (!title) return NextResponse.json({ error: "Tytuł jest wymagany" }, { status: 400 });

  const item = await prisma.galleryItem.create({
    data: { title, description: description ?? null, serviceType: serviceType ?? null, category: category ?? null, isPublic },
    include: { photos: true },
  });

  return NextResponse.json(item, { status: 201 });
}
