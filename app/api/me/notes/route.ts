import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notes = await prisma.userNote.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ data: notes });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { content } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const note = await prisma.userNote.create({
    data: { userId: session.user.id, content: content.trim() },
  });

  return NextResponse.json({ data: note });
}
