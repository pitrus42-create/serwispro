import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: clientId } = await params;

  const locations = await prisma.location.findMany({
    where: { clientId, isActive: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ data: locations });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: clientId } = await params;

  const body = await req.json();
  const location = await prisma.location.create({
    data: {
      clientId,
      name: body.name,
      address: body.address ?? null,
      city: body.city ?? null,
      postalCode: body.postalCode ?? null,
      technicalNote: body.technicalNote ?? null,
      systemsNote: body.systemsNote ?? null,
      maintenanceCycle: body.maintenanceCycle ?? "NONE",
      nextMaintenanceDate: body.nextMaintenanceDate ? new Date(body.nextMaintenanceDate) : null,
    },
  });
  return NextResponse.json({ data: location }, { status: 201 });
}
