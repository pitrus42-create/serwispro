import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const entries = await prisma.vehicleServiceEntry.findMany({
    where: { vehicleId: id },
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ data: entries });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const entry = await prisma.vehicleServiceEntry.create({
    data: {
      vehicleId: id,
      date: new Date(body.date),
      description: body.description ?? "",
      mileage: body.mileage ?? null,
      addedBy: session.user.id,
    },
  });
  return NextResponse.json({ data: entry }, { status: 201 });
}
