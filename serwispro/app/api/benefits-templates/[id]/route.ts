import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { name, title, points, serviceType, packageType, clientType, isDefault } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Nazwa jest wymagana" }, { status: 400 });
  if (!title?.trim()) return NextResponse.json({ error: "Tytuł jest wymagany" }, { status: 400 });
  if (!Array.isArray(points) || points.length === 0)
    return NextResponse.json({ error: "Punkty są wymagane" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const template = await (prisma as any).benefitsTemplate.update({
    where: { id },
    data: {
      name: name.trim(),
      title: title.trim(),
      points: JSON.stringify((points as string[]).map((p: string) => p.trim()).filter(Boolean)),
      serviceType: serviceType ?? null,
      packageType: packageType ?? null,
      clientType: clientType ?? null,
      isDefault: isDefault ?? false,
    },
  });

  return NextResponse.json(template);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).benefitsTemplate.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
