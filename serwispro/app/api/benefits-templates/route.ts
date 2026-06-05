import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const serviceType = searchParams.get("serviceType");
  const packageType = searchParams.get("packageType");
  const clientType = searchParams.get("clientType");
  const isDefaultParam = searchParams.get("isDefault");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (serviceType) where.serviceType = serviceType;
  if (packageType) where.packageType = packageType;
  if (clientType) where.clientType = clientType;
  if (isDefaultParam === "true") where.isDefault = true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const templates = await (prisma as any).benefitsTemplate.findMany({
    where,
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, title, points, serviceType, packageType, clientType, isDefault } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Nazwa jest wymagana" }, { status: 400 });
  if (!title?.trim()) return NextResponse.json({ error: "Tytuł jest wymagany" }, { status: 400 });
  if (!Array.isArray(points) || points.length === 0)
    return NextResponse.json({ error: "Punkty są wymagane" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const template = await (prisma as any).benefitsTemplate.create({
    data: {
      name: name.trim(),
      title: title.trim(),
      points: JSON.stringify((points as string[]).map((p) => p.trim()).filter(Boolean)),
      serviceType: serviceType ?? null,
      packageType: packageType ?? null,
      clientType: clientType ?? null,
      isDefault: isDefault ?? false,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(template, { status: 201 });
}
