import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pid } = await params;
  const body = await req.json();
  const { name, description, isRecommended, includes, excludes, discount, benefits } = body;

  const pkg = await prisma.quotePackage.update({
    where: { id: pid },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(isRecommended !== undefined ? { isRecommended } : {}),
      ...(includes !== undefined ? { includes } : {}),
      ...(excludes !== undefined ? { excludes } : {}),
      ...(discount !== undefined ? { discount: discount !== null ? parseFloat(discount) : null } : {}),
      ...(benefits !== undefined ? { benefits } : {}),
    },
    include: { items: true },
  });

  return NextResponse.json(pkg);
}
