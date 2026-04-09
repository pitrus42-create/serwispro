import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  const templates = await prisma.actionTemplate.findMany({
    where: {
      isActive: true,
      ...(category ? { category } : {}),
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: templates });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, content, category } = await req.json();
  if (!name || !content) return NextResponse.json({ error: "name and content required" }, { status: 400 });

  const template = await prisma.actionTemplate.create({
    data: { name, content, category: category ?? null, createdBy: session.user.id },
  });

  return NextResponse.json({ data: template }, { status: 201 });
}
