import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await prisma.benefitsTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, title, points } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Nazwa jest wymagana" }, { status: 400 });
  if (!title?.trim()) return NextResponse.json({ error: "Tytuł jest wymagany" }, { status: 400 });
  if (!Array.isArray(points) || points.length === 0)
    return NextResponse.json({ error: "Punkty są wymagane" }, { status: 400 });

  const template = await prisma.benefitsTemplate.create({
    data: {
      name: name.trim(),
      title: title.trim(),
      points: JSON.stringify((points as string[]).map((p) => p.trim()).filter(Boolean)),
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(template, { status: 201 });
}
