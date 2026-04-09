import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");

  const where: Record<string, unknown> = { isActive: true };

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { alias: { contains: q } },
      { phone: { contains: q } },
      { email: { contains: q } },
      { nip: { contains: q } },
    ];
  }

  const [total, data] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      include: {
        _count: { select: { orders: true, locations: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ data, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, name, nip, phone, phoneAlt, email, alias, notes } = body;

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const client = await prisma.client.create({
    data: {
      type: type ?? "company",
      name,
      nip: nip ?? null,
      phone: phone ?? null,
      phoneAlt: phoneAlt ?? null,
      email: email ?? null,
      alias: alias ?? null,
      notes: notes ?? null,
    },
  });

  return NextResponse.json({ data: client }, { status: 201 });
}
