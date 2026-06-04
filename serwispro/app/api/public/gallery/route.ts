import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serviceType = searchParams.get("serviceType");

  const items = await prisma.galleryItem.findMany({
    where: {
      isPublic: true,
      ...(serviceType ? { serviceType } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      photos: {
        orderBy: [{ isMain: "desc" }, { uploadedAt: "asc" }],
        take: 6,
      },
    },
  });

  return NextResponse.json(items);
}
